/**
 * Cloud Functions for Invoice Operations
 *
 * Server-side business logic for invoice operations
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface DeleteInvoiceRequest {
    invoiceId: string;
    tenantId: string;
    force?: boolean;
}

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
 * Securely delete an invoice with server-side validation
 */
export const deleteInvoice = functions.https.onCall(
    async (data: DeleteInvoiceRequest, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated'
            );
        }

        const { invoiceId, tenantId, force = false } = data;
        const userId = context.auth.uid;

        try {
            // Verify permissions
            const { isAuthorized, userRole, userEmail } = await verifyTenantMembership(
                userId,
                tenantId,
                ['admin', 'owner']
            );

            if (!isAuthorized) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You do not have permission to delete invoices'
                );
            }

            // Get invoice
            const invoiceRef = db
                .collection('tenants')
                .doc(tenantId)
                .collection('invoices')
                .doc(invoiceId);

            const invoiceDoc = await invoiceRef.get();
            if (!invoiceDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Invoice not found');
            }

            const invoice = invoiceDoc.data();

            // Check if invoice is paid
            if (invoice?.status === 'paid' && !force) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Cannot delete paid invoice without force flag'
                );
            }

            // Delete invoice
            await invoiceRef.delete();

            // Unlink from loads
            if (invoice?.loadIds && invoice.loadIds.length > 0) {
                const batch = db.batch();
                for (const loadId of invoice.loadIds) {
                    const loadRef = db
                        .collection('tenants')
                        .doc(tenantId)
                        .collection('loads')
                        .doc(loadId);
                    batch.update(loadRef, {
                        invoiceId: admin.firestore.FieldValue.delete(),
                        invoiceNumber: admin.firestore.FieldValue.delete(),
                    });
                }
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
                    action: 'delete_invoice',
                    entityType: 'invoice',
                    entityId: invoiceId,
                    entityData: invoice,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: { force },
                });

            functions.logger.info('Invoice deleted successfully', {
                tenantId,
                invoiceId,
                userId,
            });

            return { success: true, message: 'Invoice deleted successfully' };
        } catch (error) {
            functions.logger.error('Error deleting invoice', { tenantId, invoiceId, error });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to delete invoice', error);
        }
    }
);

/**
 * Generate invoice from delivered loads
 */
export const generateInvoice = functions.https.onCall(
    async (
        data: { tenantId: string; loadIds: string[] },
        context: functions.https.CallableContext
    ) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { tenantId, loadIds } = data;
        const userId = context.auth.uid;

        try {
            // Verify permissions
            const { isAuthorized } = await verifyTenantMembership(userId, tenantId, [
                'admin',
                'dispatcher',
                'owner',
            ]);

            if (!isAuthorized) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'You do not have permission to generate invoices'
                );
            }

            // Validate loads exist and are delivered
            const loadsRef = db.collection('tenants').doc(tenantId).collection('loads');
            const loadDocs = await Promise.all(loadIds.map(id => loadsRef.doc(id).get()));

            const loads = loadDocs
                .filter(doc => doc.exists)
                .map(doc => ({ id: doc.id, ...doc.data() }));

            if (loads.length === 0) {
                throw new functions.https.HttpsError('invalid-argument', 'No valid loads found');
            }

            // Check all loads are delivered
            const undeliveredLoads = loads.filter(
                load => load.status !== 'Delivered' && load.status !== 'Completed'
            );

            if (undeliveredLoads.length > 0) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'All loads must be delivered to generate invoice'
                );
            }

            // Calculate total amount
            const totalAmount = loads.reduce((sum, load) => sum + (load.grandTotal || load.rate || 0), 0);

            // Get customer name from first load
            const customerName = loads[0].customerName || loads[0].brokerName;

            // Generate invoice number
            const invoicesSnapshot = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('invoices')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            const lastInvoiceNumber = invoicesSnapshot.empty
                ? 0
                : parseInt(invoicesSnapshot.docs[0].data().invoiceNumber?.split('-')[2] || '0');

            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(lastInvoiceNumber + 1).padStart(4, '0')}`;

            // Create invoice
            const invoice = {
                invoiceNumber,
                loadIds,
                customerName,
                amount: totalAmount,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: userId,
            };

            const invoiceRef = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('invoices')
                .add(invoice);

            // Update loads with invoice reference
            const batch = db.batch();
            loadIds.forEach(loadId => {
                const loadRef = loadsRef.doc(loadId);
                batch.update(loadRef, {
                    invoiceId: invoiceRef.id,
                    invoiceNumber,
                    invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();

            functions.logger.info('Invoice generated successfully', {
                tenantId,
                invoiceId: invoiceRef.id,
                invoiceNumber,
                loadCount: loadIds.length,
            });

            return {
                success: true,
                invoiceId: invoiceRef.id,
                invoiceNumber,
                amount: totalAmount,
            };
        } catch (error) {
            functions.logger.error('Error generating invoice', { tenantId, error });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError('internal', 'Failed to generate invoice', error);
        }
    }
);
