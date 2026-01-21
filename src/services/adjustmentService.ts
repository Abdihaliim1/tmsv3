/**
 * Adjustment Service - Post-Delivery Load Changes with Approval Workflow
 * 
 * Handles adjustments to delivered/completed loads with optional approval requirement.
 * 
 * Path: tenants/{tenantId}/loads/{loadId}/adjustments/{adjId}
 */

import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Adjustment } from '../types';
import { auditAdjustment } from '../data/audit';

/**
 * Create an adjustment request for a delivered load
 * 
 * @param tenantId - Tenant ID
 * @param loadId - Load ID
 * @param patch - Fields to update (e.g., { rate: 1200, miles: 500 })
 * @param reason - Required reason for the adjustment
 * @param createdBy - User UID who created the adjustment
 * @param requireApproval - If true, adjustment must be approved before applying
 * @returns Adjustment ID
 */
export async function createAdjustment(
  tenantId: string,
  loadId: string,
  patch: Record<string, any>,
  reason: string,
  createdBy: string,
  requireApproval: boolean = false
): Promise<string> {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Adjustment reason is required');
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('Adjustment patch cannot be empty');
  }

  const adjustment: Omit<Adjustment, 'id'> = {
    loadId,
    tenantId,
    status: requireApproval ? 'pending' : 'approved',
    patch,
    reason: reason.trim(),
    createdBy,
    createdAt: new Date().toISOString(),
    requireApproval,
  };

  // Add to Firestore
  const adjustmentsRef = collection(db, `tenants/${tenantId}/loads/${loadId}/adjustments`);
  const docRef = await addDoc(adjustmentsRef, {
    ...adjustment,
    createdAt: serverTimestamp(),
  });

  // If auto-approved, apply immediately
  if (!requireApproval) {
    await applyAdjustment(tenantId, loadId, docRef.id, createdBy);
  }

  return docRef.id;
}

/**
 * Approve an adjustment and apply it to the load
 * 
 * @param tenantId - Tenant ID
 * @param loadId - Load ID
 * @param adjustmentId - Adjustment ID
 * @param approvedBy - User UID who approved
 */
export async function approveAdjustment(
  tenantId: string,
  loadId: string,
  adjustmentId: string,
  approvedBy: string
): Promise<void> {
  const adjustmentRef = doc(db, `tenants/${tenantId}/loads/${loadId}/adjustments/${adjustmentId}`);
  const adjustmentSnap = await getDoc(adjustmentRef);

  if (!adjustmentSnap.exists()) {
    throw new Error('Adjustment not found');
  }

  const adjustment = adjustmentSnap.data() as Adjustment;

  if (adjustment.status !== 'pending') {
    throw new Error(`Adjustment is already ${adjustment.status}`);
  }

  // Update adjustment status
  await updateDoc(adjustmentRef, {
    status: 'approved',
    approvedBy,
    approvedAt: serverTimestamp(),
  });

  // Apply the adjustment
  await applyAdjustment(tenantId, loadId, adjustmentId, approvedBy);
}

/**
 * Reject an adjustment
 * 
 * @param tenantId - Tenant ID
 * @param loadId - Load ID
 * @param adjustmentId - Adjustment ID
 * @param rejectedBy - User UID who rejected
 * @param rejectionReason - Reason for rejection
 */
export async function rejectAdjustment(
  tenantId: string,
  loadId: string,
  adjustmentId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<void> {
  const adjustmentRef = doc(db, `tenants/${tenantId}/loads/${loadId}/adjustments/${adjustmentId}`);
  const adjustmentSnap = await getDoc(adjustmentRef);

  if (!adjustmentSnap.exists()) {
    throw new Error('Adjustment not found');
  }

  const adjustment = adjustmentSnap.data() as Adjustment;

  if (adjustment.status !== 'pending') {
    throw new Error(`Adjustment is already ${adjustment.status}`);
  }

  await updateDoc(adjustmentRef, {
    status: 'rejected',
    rejectedBy,
    rejectedAt: serverTimestamp(),
    rejectionReason: rejectionReason.trim(),
  });
}

/**
 * Apply an approved adjustment to the load
 * 
 * This is called automatically when:
 * - Adjustment is auto-approved (requireApproval = false)
 * - Adjustment is manually approved
 * 
 * @param tenantId - Tenant ID
 * @param loadId - Load ID
 * @param adjustmentId - Adjustment ID
 * @param appliedBy - User UID who applied (approver or creator)
 */
async function applyAdjustment(
  tenantId: string,
  loadId: string,
  adjustmentId: string,
  appliedBy: string
): Promise<void> {
  const adjustmentRef = doc(db, `tenants/${tenantId}/loads/${loadId}/adjustments/${adjustmentId}`);
  const adjustmentSnap = await getDoc(adjustmentRef);

  if (!adjustmentSnap.exists()) {
    throw new Error('Adjustment not found');
  }

  const adjustment = adjustmentSnap.data() as Adjustment;

  // Get current load
  const loadRef = doc(db, `tenants/${tenantId}/loads/${loadId}`);
  const loadSnap = await getDoc(loadRef);

  if (!loadSnap.exists()) {
    throw new Error('Load not found');
  }

  const currentLoad = loadSnap.data();

  // Apply patch
  const updatedLoad = {
    ...currentLoad,
    ...adjustment.patch,
    updatedAt: serverTimestamp(),
  };

  // Update load
  await updateDoc(loadRef, updatedLoad);

  // Note: Audit logging will be handled by the calling function (updateLoad)
}

/**
 * Get all adjustments for a load
 * 
 * @param tenantId - Tenant ID
 * @param loadId - Load ID
 * @param status - Optional status filter
 * @returns Array of adjustments
 */
export async function getLoadAdjustments(
  tenantId: string,
  loadId: string,
  status?: Adjustment['status']
): Promise<Adjustment[]> {
  const adjustmentsRef = collection(db, `tenants/${tenantId}/loads/${loadId}/adjustments`);
  
  let q = query(adjustmentsRef, orderBy('createdAt', 'desc'));
  
  if (status) {
    q = query(adjustmentsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Adjustment[];
}

/**
 * Get pending adjustments for a tenant (admin view)
 * 
 * @param tenantId - Tenant ID
 * @returns Array of pending adjustments
 */
export async function getPendingAdjustments(tenantId: string): Promise<Adjustment[]> {
  // Note: This requires a collection group query or separate index
  // For now, we'll query per load (can be optimized later)
  // This is a simplified version - in production, use collection group query
  
  const adjustments: Adjustment[] = [];
  
  // TODO: Implement collection group query for better performance
  // For now, this would need to be called per load or use a different structure
  
  return adjustments;
}


