/**
 * Load Locking Service - Post-Delivery Edit Tracking
 * 
 * For delivered/completed loads:
 * - ALL changes are allowed
 * - BUT all changes require a reason (audit trail)
 */

import { Load, LoadStatus } from '../types';

/**
 * Fields that don't require a reason (non-material changes)
 */
const NO_REASON_REQUIRED_FIELDS = [
  'documents', // Document uploads
  'notes', // Internal notes
  'podNumber', // POD number
  'bolNumber', // BOL number
  'status', // Status changes (e.g., DELIVERED -> COMPLETED)
  'invoiceId', // Linking invoice
  'settlementId', // Linking settlement
] as const;

/**
 * Check if a load is delivered/completed (requires reason for most changes)
 */
export function isLoadLocked(load: Load): boolean {
  return load.status === LoadStatus.Delivered || 
         load.status === LoadStatus.Completed ||
         load.isLocked === true;
}

/**
 * Check if a specific field change requires a reason
 */
export function fieldRequiresReason(field: string): boolean {
  return !NO_REASON_REQUIRED_FIELDS.includes(field as any);
}

/**
 * Validate if updates to a delivered load require a reason
 * 
 * @param load - The load being updated
 * @param updates - Object with fields to update
 * @returns Validation result - always allowed, but indicates if reason needed
 */
export function validatePostDeliveryUpdates(
  load: Load,
  updates: Partial<Load>
): { allowed: boolean; blockedFields: string[]; requiresReason: boolean; changedFields: string[]; reason?: string } {
  // If load is not delivered, no restrictions
  if (!isLoadLocked(load)) {
    return { allowed: true, blockedFields: [], requiresReason: false, changedFields: [] };
  }

  // Find which fields are actually changing
  const changedFields: string[] = [];
  const fieldsNeedingReason: string[] = [];

  for (const field in updates) {
    const oldValue = load[field as keyof Load];
    const newValue = updates[field as keyof Load];
    
    // Skip if value hasn't actually changed
    if (oldValue === newValue) continue;
    
    changedFields.push(field);
    
    if (fieldRequiresReason(field)) {
      fieldsNeedingReason.push(field);
    }
  }

  // All changes are ALLOWED, but we track if a reason is needed
  return { 
    allowed: true, // Always allow - no blocking
    blockedFields: [], // Nothing is blocked
    requiresReason: fieldsNeedingReason.length > 0,
    changedFields: fieldsNeedingReason,
    reason: fieldsNeedingReason.length > 0 
      ? `Changes to delivered load require a reason for: ${fieldsNeedingReason.join(', ')}`
      : undefined
  };
}

/**
 * Legacy function - now always returns allowed: true
 */
export function validatePostDeliveryUpdate(
  load: Load,
  field: string,
  newValue: any
): { allowed: boolean; reason?: string } {
  return { allowed: true };
}

/**
 * Get fields that don't require a reason
 */
export function getNoReasonFields(): readonly string[] {
  return NO_REASON_REQUIRED_FIELDS;
}

