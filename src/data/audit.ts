/**
 * Audit Trail Service - Universal Audit Logging
 * 
 * Logs all CREATE/UPDATE/DELETE/STATUS_CHANGE/ADJUSTMENT actions
 * for compliance, debugging, and accountability.
 */

import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "ADJUSTMENT";

export interface AuditLogParams {
  tenantId: string;
  actorUid: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  before?: any;
  after?: any;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Write an audit log entry to Firestore
 * 
 * Path: tenants/{tenantId}/auditLogs/{logId}
 * 
 * @param params - Audit log parameters
 */
/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 */
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    // Get user agent and path (client-side only)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
    const path = typeof window !== 'undefined' ? window.location.pathname : 'unknown';

    // Clean params to remove undefined values (Firestore doesn't allow undefined)
    // Deep clean all nested objects to ensure no undefined values slip through
    const cleanedParams = {
      tenantId: params.tenantId,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      summary: params.summary || '',
      before: params.before ? removeUndefined(params.before) : null,
      after: params.after ? removeUndefined(params.after) : null,
      reason: params.reason || null,
      metadata: params.metadata ? removeUndefined(params.metadata) : null,
      userAgent,
      path,
      createdAt: serverTimestamp(),
      timestamp: new Date().toISOString(), // Also store ISO string for easier querying
    };

    // Double-check: Remove any remaining undefined values at top level
    const finalParams: any = {};
    for (const key in cleanedParams) {
      if (cleanedParams[key as keyof typeof cleanedParams] !== undefined) {
        finalParams[key] = cleanedParams[key as keyof typeof cleanedParams];
      }
    }

    await addDoc(collection(db, `tenants/${params.tenantId}/auditLogs`), finalParams);
  } catch (error) {
    // Don't throw - audit logging should never break the app
    // But log to console for debugging
    console.error('Failed to write audit log:', error);
    
    // Fallback: Store in localStorage if Firestore fails (for offline/development)
    if (typeof window !== 'undefined') {
      try {
        const fallbackKey = `audit_logs_${params.tenantId}_${Date.now()}`;
        const fallbackLog = {
          ...params,
          userAgent: navigator.userAgent,
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
          _fallback: true, // Mark as fallback
        };
        localStorage.setItem(fallbackKey, JSON.stringify(fallbackLog));
      } catch (fallbackError) {
        console.error('Failed to write fallback audit log:', fallbackError);
      }
    }
  }
}

/**
 * Helper: Create audit log for CREATE action
 */
export async function auditCreate(
  tenantId: string,
  actorUid: string,
  actorRole: string,
  entityType: string,
  entityId: string,
  entityData: any,
  summary?: string
): Promise<void> {
  await writeAuditLog({
    tenantId,
    actorUid,
    actorRole,
    entityType,
    entityId,
    action: "CREATE",
    summary: summary || `Created ${entityType} ${entityId}`,
    after: entityData,
  });
}

/**
 * Helper: Create audit log for UPDATE action
 */
export async function auditUpdate(
  tenantId: string,
  actorUid: string,
  actorRole: string,
  entityType: string,
  entityId: string,
  before: any,
  after: any,
  summary?: string,
  reason?: string
): Promise<void> {
  await writeAuditLog({
    tenantId,
    actorUid,
    actorRole,
    entityType,
    entityId,
    action: "UPDATE",
    summary: summary || `Updated ${entityType} ${entityId}`,
    before,
    after,
    reason,
  });
}

/**
 * Helper: Create audit log for DELETE action
 */
export async function auditDelete(
  tenantId: string,
  actorUid: string,
  actorRole: string,
  entityType: string,
  entityId: string,
  entityData: any,
  summary?: string
): Promise<void> {
  await writeAuditLog({
    tenantId,
    actorUid,
    actorRole,
    entityType,
    entityId,
    action: "DELETE",
    summary: summary || `Deleted ${entityType} ${entityId}`,
    before: entityData,
  });
}

/**
 * Helper: Create audit log for STATUS_CHANGE action
 */
export async function auditStatusChange(
  tenantId: string,
  actorUid: string,
  actorRole: string,
  entityType: string,
  entityId: string,
  oldStatus: string,
  newStatus: string,
  summary?: string
): Promise<void> {
  await writeAuditLog({
    tenantId,
    actorUid,
    actorRole,
    entityType,
    entityId,
    action: "STATUS_CHANGE",
    summary: summary || `Changed ${entityType} ${entityId} status from ${oldStatus} to ${newStatus}`,
    before: { status: oldStatus },
    after: { status: newStatus },
  });
}

/**
 * Helper: Create audit log for ADJUSTMENT action (post-delivery changes)
 */
export async function auditAdjustment(
  tenantId: string,
  actorUid: string,
  actorRole: string,
  entityType: string,
  entityId: string,
  before: any,
  after: any,
  reason: string,
  summary?: string
): Promise<void> {
  await writeAuditLog({
    tenantId,
    actorUid,
    actorRole,
    entityType,
    entityId,
    action: "ADJUSTMENT",
    summary: summary || `Adjusted ${entityType} ${entityId}`,
    before,
    after,
    reason, // Required for adjustments
  });
}

