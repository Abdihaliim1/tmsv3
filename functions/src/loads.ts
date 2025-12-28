/**
 * Cloud Functions for Load Operations
 *
 * Server-side business logic for critical load operations
 * to enforce security and data integrity.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

interface DeleteLoadRequest {
  loadId: string;
  tenantId: string;
  force?: boolean;
}

interface DeleteLoadResponse {
  success: boolean;
  message: string;
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
    functions.logger.warn('User not member of tenant', { userId, tenantId });
    return { isAuthorized: false, userRole: '', userEmail };
  }

  const membership = membershipDoc.data();
  if (membership?.active === false) {
    functions.logger.warn('User membership inactive', { userId, tenantId });
    return { isAuthorized: false, userRole: '', userEmail };
  }

  const userRole = membership?.role || 'viewer';
  const isAuthorized = requiredRoles.includes(userRole);

  return { isAuthorized, userRole, userEmail };
}

/**
 * Securely delete a load with server-side validation
 *
 * Security checks:
 * - User authentication
 * - Tenant membership verification
 * - Role-based permission verification
 * - Invoice/settlement dependency checks
 * - Audit logging
 */
export const deleteLoad = functions.https.onCall(
  async (
    data: DeleteLoadRequest,
    context: functions.https.CallableContext
  ): Promise<DeleteLoadResponse> => {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to delete loads'
      );
    }

    const { loadId, tenantId, force = false } = data;
    const userId = context.auth.uid;

    try {
      // CRITICAL: Verify user belongs to tenant and has permission
      const { isAuthorized, userRole, userEmail } = await verifyTenantMembership(
        userId,
        tenantId,
        ['admin', 'dispatcher', 'owner']
      );

      if (!isAuthorized) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to delete loads in this tenant'
        );
      }

      functions.logger.info('Delete authorization check passed', {
        userId,
        tenantId,
        userRole,
      });

      // Get the load
      const loadRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('loads')
        .doc(loadId);

      const loadDoc = await loadRef.get();

      if (!loadDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Load not found'
        );
      }

      const load = loadDoc.data();

      // Check for linked invoices
      const invoicesQuery = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('invoices')
        .where('loadId', '==', loadId)
        .get();

      if (!invoicesQuery.empty && !force) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot delete load: ${invoicesQuery.size} invoice(s) are linked. Please delete or unlink invoices first, or use force delete.`
        );
      }

      // Check for linked settlements
      const settlementsQuery = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('settlements')
        .where('loads', 'array-contains', loadId)
        .get();

      if (!settlementsQuery.empty && !force) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot delete load: ${settlementsQuery.size} settlement(s) are linked. Please remove load from settlements first, or use force delete.`
        );
      }

      // If force delete, remove references
      if (force) {
        const batch = db.batch();

        // Unlink from invoices
        invoicesQuery.docs.forEach((doc) => {
          batch.update(doc.ref, { loadId: null });
        });

        // Remove from settlements
        settlementsQuery.docs.forEach((doc) => {
          const currentLoads = doc.data().loads || [];
          const updatedLoads = currentLoads.filter((id: string) => id !== loadId);
          batch.update(doc.ref, { loads: updatedLoads });
        });

        await batch.commit();
      }

      // Delete the load
      await loadRef.delete();

      // Audit log (tenant-scoped path)
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('auditLogs')
        .add({
          userId,
          userEmail,
          action: 'delete_load',
          entityType: 'load',
          entityId: loadId,
          entityData: load,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          metadata: {
            force,
            linkedInvoices: invoicesQuery.size,
            linkedSettlements: settlementsQuery.size,
          },
        });

      functions.logger.info('Load deleted successfully', {
        tenantId,
        loadId,
        userId,
        force,
      });

      return {
        success: true,
        message: `Load ${load?.loadNumber || loadId} deleted successfully`,
      };
    } catch (error) {
      functions.logger.error('Error deleting load', {
        tenantId,
        loadId,
        userId,
        error,
      });

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to delete load. Please try again.',
        error
      );
    }
  }
);

/**
 * Allowlist of fields that can be updated by role
 */
const UPDATABLE_FIELDS_BY_ROLE = {
  admin: [
    'status',
    'driverId',
    'dispatcherId',
    'rate',
    'driverPay',
    'originCity',
    'originState',
    'destCity',
    'destState',
    'pickupDate',
    'deliveryDate',
    'miles',
    'weight',
    'commodity',
    'customerName',
    'brokerName',
    'factoringCompanyId',
    'isFactored',
    'notes',
    'truckId',
    'trailerId',
  ],
  dispatcher: [
    'status',
    'driverId',
    'dispatcherId',
    'pickupDate',
    'deliveryDate',
    'notes',
    'truckId',
    'trailerId',
  ],
  owner: [
    'status',
    'driverId',
    'dispatcherId',
    'rate',
    'driverPay',
    'originCity',
    'originState',
    'destCity',
    'destState',
    'pickupDate',
    'deliveryDate',
    'miles',
    'weight',
    'commodity',
    'customerName',
    'brokerName',
    'factoringCompanyId',
    'isFactored',
    'notes',
    'truckId',
    'trailerId',
  ],
  viewer: [], // Viewers cannot update
};

/**
 * Validate and filter updates based on role permissions
 */
function validateAndFilterUpdates(
  updates: Record<string, unknown>,
  userRole: string
): Record<string, unknown> {
  const allowedFields =
    UPDATABLE_FIELDS_BY_ROLE[userRole as keyof typeof UPDATABLE_FIELDS_BY_ROLE] || [];

  const filteredUpdates: Record<string, unknown> = {};
  const rejectedFields: string[] = [];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    } else {
      rejectedFields.push(key);
    }
  });

  if (rejectedFields.length > 0) {
    functions.logger.warn('Rejected unauthorized field updates', {
      userRole,
      rejectedFields,
    });
  }

  return filteredUpdates;
}

/**
 * Update load with server-side validation
 *
 * Security checks:
 * - User authentication
 * - Tenant membership verification
 * - Role-based permission verification
 * - Field-level access control (allowlist)
 * - Post-delivery update validation
 * - Adjustment tracking
 */
export const updateLoad = functions.https.onCall(
  async (
    data: {
      loadId: string;
      tenantId: string;
      updates: Record<string, unknown>;
      reason?: string;
    },
    context: functions.https.CallableContext
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { loadId, tenantId, updates, reason } = data;
    const userId = context.auth.uid;

    try {
      // CRITICAL: Verify user belongs to tenant and has permission
      const { isAuthorized, userRole, userEmail } = await verifyTenantMembership(
        userId,
        tenantId,
        ['admin', 'dispatcher', 'owner']
      );

      if (!isAuthorized) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not have permission to update loads in this tenant'
        );
      }

      // CRITICAL: Filter updates based on role permissions
      const allowedUpdates = validateAndFilterUpdates(updates, userRole);

      if (Object.keys(allowedUpdates).length === 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'No valid fields to update for your role'
        );
      }

      // Get load
      const loadRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('loads')
        .doc(loadId);

      const loadDoc = await loadRef.get();
      if (!loadDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Load not found');
      }

      const load = loadDoc.data();

      // Check if load is delivered (locked)
      const isDelivered =
        load?.status === 'Delivered' || load?.status === 'Completed';

      if (isDelivered) {
        // Require reason for post-delivery updates
        if (!reason || reason.trim().length === 0) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Post-delivery updates require a reason'
          );
        }

        // Track as adjustment
        const adjustmentLog = load?.adjustmentLog || [];
        adjustmentLog.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          changedBy: userEmail,
          changes: allowedUpdates,
          reason,
        });

        allowedUpdates.adjustmentLog = adjustmentLog;
      }

      // Update load with only allowed fields
      await loadRef.update({
        ...allowedUpdates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Audit log (tenant-scoped path)
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('auditLogs')
        .add({
          userId,
          userEmail,
          action: 'update_load',
          entityType: 'load',
          entityId: loadId,
          updates: allowedUpdates,
          reason,
          isAdjustment: isDelivered,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return { success: true };
    } catch (error) {
      functions.logger.error('Error updating load', { tenantId, loadId, error });

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        'Failed to update load',
        error
      );
    }
  }
);
