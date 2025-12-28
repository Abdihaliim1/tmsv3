/**
 * Cloud Functions for Settlement Operations
 *
 * Server-side business logic for settlement calculations and operations
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Verify user belongs to tenant and has required role
 */
async function verifyTenantMembership(
    userId: string,
    tenantId: string,
    requiredRoles: string[]
): Promise<{ isAuthorized: boolean; userRole: string; userEmail: string }> {
    const userRef = db.collection('users').doc(userId);
    const membershipRef = userRef.collection('memberships').doc(tenantId);

    const [userDoc, membershipDoc] = await Promise.all([
        userRef.get(),
        membershipRef.get(),
    ]);

    const userEmail = userDoc.exists ? userDoc.data()?.email || 'unknown' : 'unknown';

    if (!membershipDoc.exists) {
        return { isAuthorized: false, userRole: '', userEmail };
    }

    const membership = membershipDoc.data();
    if (membership?.active === false) {
        return { isAuthorized: false, userRole: '', userEmail };
    }

    const userRole = membership?.role || 'viewer';
    const isAuthorized = requiredRoles.includes(userRole);

    return { isAuthorized, userRole, userEmail };
}

/**
 * Calculate settlement for driver based on loads
 */
export const calculateSettlement = functions.https.onCall(
    async (
        data: { tenantId: string; driverId: string; loadIds: string[] },
        context: functions.https.CallableContext
    ) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { tenantId, driverId, loadIds } = data;
        const userId = context.auth.uid;

        try {
            // Verify permissions
            const { isAuthorized, userEmail } = await verifyTenantMembership(userId, tenantId, [
                'admin',
                'dispatcher',
                'owner',
            ]);

            if (!isAuthorized) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You do not have permission to calculate settlements'
                );
            }

            // Get driver
            const driverDoc = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('employees')
                .doc(driverId)
                .get();

            if (!driverDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Driver not found');
            }

            const driver = driverDoc.data();

            // Get loads
            const loadsRef = db.collection('tenants').doc(tenantId).collection('loads');
            const loadDocs = await Promise.all(loadIds.map(id => loadsRef.doc(id).get()));

            const loads = loadDocs
                .filter(doc => doc.exists)
                .map(doc => ({ id: doc.id, ...doc.data() }));

            if (loads.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', 'No valid loads found');
            }

            // Validate all loads belong to this driver
            const invalidLoads = loads.filter(load => load.driverId !== driverId);
            if (invalidLoads.length > 0) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'All loads must belong to the specified driver'
                );
            }

            // Calculate gross pay based on driver type
            let grossPay = 0;
            const driverType = driver?.type || 'Company';
            const rateOrSplit = driver?.rateOrSplit || 0;

            loads.forEach(load => {
                if (driverType === 'OwnerOperator') {
                    // Owner Operator: (Load Rate - Expenses) * Split%
                    const expenses = 0; // TODO: Calculate actual expenses
                    grossPay += (load.rate - expenses) * (rateOrSplit / 100);
                } else {
                    // Company Driver: Miles * Rate per mile
                    grossPay += load.miles * rateOrSplit;
                }
            });

            // Calculate deductions (placeholder - should be customizable)
            const deductions = {
                // Add actual deduction logic here
            };
            const totalDeductions = 0;

            const netPay = grossPay - totalDeductions;

            // Generate settlement number
            const settlementsSnapshot = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('settlements')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            const lastSettlementNumber = settlementsSnapshot.empty
                ? 1000
                : parseInt(settlementsSnapshot.docs[0].data().settlementNumber?.split('-')[2] || '1000');

            const settlementNumber = `ST-${new Date().getFullYear()}-${lastSettlementNumber + 1}`;

            // Create settlement
            const settlement = {
                settlementNumber,
                driverId,
                driverName: `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim(),
                loadIds,
                grossPay,
                deductions,
                totalDeductions,
                netPay,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: userId,
            };

            const settlementRef = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('settlements')
                .add(settlement);

            // Update loads with settlement reference
            const batch = db.batch();
            loadIds.forEach(loadId => {
                const loadRef = loadsRef.doc(loadId);
                batch.update(loadRef, {
                    settlementId: settlementRef.id,
                    settledAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();

            // Audit log
            await db
                .collection('tenants')
                .doc(tenantId)
                .collection('auditLogs')
                .add({
                    userId,
                    userEmail,
                    action: 'calculate_settlement',
                    entityType: 'settlement',
                    entityId: settlementRef.id,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: {
                        driverId,
                        loadCount: loadIds.length,
                        grossPay,
                        netPay,
                    },
                });

            functions.logger.info('Settlement calculated successfully', {
                tenantId,
                settlementId: settlementRef.id,
                settlementNumber,
                driverId,
                loadCount: loadIds.length,
            });

            return {
                success: true,
                settlementId: settlementRef.id,
                settlementNumber,
                grossPay,
                netPay,
            };
        } catch (error) {
            functions.logger.error('Error calculating settlement', { tenantId, driverId, error });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to calculate settlement', error);
        }
    }
);

/**
 * Securely delete a settlement
 */
export const deleteSettlement = functions.https.onCall(
    async (
        data: { settlementId: string; tenantId: string; force?: boolean },
        context: functions.https.CallableContext
    ) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { settlementId, tenantId, force = false } = data;
        const userId = context.auth.uid;

        try {
            // Verify permissions
            const { isAuthorized, userEmail } = await verifyTenantMembership(userId, tenantId, [
                'admin',
                'owner',
            ]);

            if (!isAuthorized) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You do not have permission to delete settlements'
                );
            }

            // Get settlement
            const settlementRef = db
                .collection('tenants')
                .doc(tenantId)
                .collection('settlements')
                .doc(settlementId);

            const settlementDoc = await settlementRef.get();
            if (!settlementDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Settlement not found');
            }

            const settlement = settlementDoc.data();

            // Check if settlement is paid
            if (settlement?.status === 'paid' && !force) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Cannot delete paid settlement without force flag'
                );
            }

            // Delete settlement
            await settlementRef.delete();

            // Unlink from loads
            if (settlement?.loadIds && settlement.loadIds.length > 0) {
                const batch = db.batch();
                const loadsRef = db.collection('tenants').doc(tenantId).collection('loads');

                settlement.loadIds.forEach((loadId: string) => {
                    const loadRef = loadsRef.doc(loadId);
                    batch.update(loadRef, {
                        settlementId: admin.firestore.FieldValue.delete(),
                    });
                });

                await batch.commit();
            }

            // Audit log
            await db
                .collection('tenants')
                .doc(tenantId)
                .collection('auditLogs')
                .add({
                    userId,
                    userEmail,
                    action: 'delete_settlement',
                    entityType: 'settlement',
                    entityId: settlementId,
                    entityData: settlement,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: { force },
                });

            functions.logger.info('Settlement deleted successfully', {
                tenantId,
                settlementId,
                userId,
            });

            return { success: true, message: 'Settlement deleted successfully' };
        } catch (error) {
            functions.logger.error('Error deleting settlement', { tenantId, settlementId, error });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to delete settlement', error);
        }
    }
);
