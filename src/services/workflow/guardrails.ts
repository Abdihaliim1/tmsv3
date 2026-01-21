/**
 * Guardrails - Operational Rules Enforcement
 * 
 * Handles:
 * - Validation checks before allowing operations
 * - Blocked task creation when requirements aren't met
 */

import { Load, Invoice } from '../../types';
import { canInvoiceLoad, canDispatchLoad } from '../documentService';
import { createTaskIfNotExists, generateDedupeKey } from './taskService';
// Tenant ID should be passed as parameter

/**
 * Check if load can be invoiced and create blocked task if not
 */
export function checkCanInvoice(
  tenantId: string,
  load: Load,
  documents?: Array<{ type: string; entityId: string }>
): { ok: boolean; blockers: string[]; taskCreated?: boolean } {
  const blockers: string[] = [];

  // Check delivery date
  if (!load.deliveryDate && !load.pickupDate) {
    blockers.push('Missing delivery date');
  }

  // Check customer/broker
  if (!load.brokerName && !load.customerName) {
    blockers.push('Missing broker/customer');
  }

  // Check rate
  if (!load.rate || load.rate <= 0) {
    blockers.push('Invalid rate (must be greater than 0)');
  }

  // Check POD (use document service)
  const docCheck = canInvoiceLoad(load);
  if (!docCheck.canInvoice && docCheck.reason) {
    blockers.push(docCheck.reason);
  }

  // If blocked, create a blocked task
  if (blockers.length > 0) {
    const dedupeKey = generateDedupeKey(tenantId, 'load', load.id, 'INVOICE_BLOCKED');

    createTaskIfNotExists(tenantId, {
      entityType: 'load',
      entityId: load.id,
      templateKey: 'INVOICE_BLOCKED',
      dedupeKey,
      title: `Invoice blocked for Load ${load.loadNumber}`,
      description: `Cannot create invoice due to: ${blockers.join(', ')}`,
      priority: 'high',
      status: 'blocked',
      blockers,
      tags: ['invoice', 'blocked', 'load'],
    });

    return { ok: false, blockers, taskCreated: true };
  }

  return { ok: true, blockers: [] };
}

/**
 * Check if load can be dispatched and create blocked task if not
 */
export function checkCanDispatch(
  tenantId: string,
  load: Load,
  documents?: Array<{ type: string; entityId: string }>
): { ok: boolean; blockers: string[]; taskCreated?: boolean } {
  const blockers: string[] = [];

  // Check driver assignment
  if (!load.driverId) {
    blockers.push('Missing driver assignment');
  }

  // Check BOL and rate confirmation (use document service)
  const dispatchCheck = canDispatchLoad(load);
  if (!dispatchCheck.canDispatch && dispatchCheck.reason) {
    blockers.push(dispatchCheck.reason);
  }

  // Check pickup date
  if (!load.pickupDate) {
    blockers.push('Missing pickup date');
  }

  // If blocked, create a blocked task
  if (blockers.length > 0) {
    const dedupeKey = generateDedupeKey(tenantId, 'load', load.id, 'DISPATCH_BLOCKED');

    createTaskIfNotExists(tenantId, {
      entityType: 'load',
      entityId: load.id,
      templateKey: 'DISPATCH_BLOCKED',
      dedupeKey,
      title: `Dispatch blocked for Load ${load.loadNumber}`,
      description: `Cannot dispatch load due to: ${blockers.join(', ')}`,
      priority: 'high',
      status: 'blocked',
      blockers,
      tags: ['dispatch', 'blocked', 'load'],
    });

    return { ok: false, blockers, taskCreated: true };
  }

  return { ok: true, blockers: [] };
}

/**
 * Validate invoice requirements
 */
export function validateInvoiceRequirements(invoice: Invoice): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (!invoice.customerName) {
    blockers.push('Missing customer name');
  }

  if (!invoice.amount || invoice.amount <= 0) {
    blockers.push('Invalid invoice amount');
  }

  if (!invoice.date) {
    blockers.push('Missing invoice date');
  }

  return { ok: blockers.length === 0, blockers };
}

