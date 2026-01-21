/**
 * Workflow Engine - Event-Driven Task Creation
 * 
 * Handles:
 * - Processing workflow events
 * - Matching rules to events
 * - Creating tasks idempotently
 */

import { WorkflowEvent, WorkflowRule, Task, TaskPriority } from '../../types';
import { loadWorkflowRules } from './workflowRules';
import { createTaskIfNotExists, generateDedupeKey } from './taskService';
import { generateEventId } from '../../utils/idGenerator';
// Tenant ID should be passed as parameter

/**
 * Match a rule filter against an event payload
 */
function matchesRuleFilter(rule: WorkflowRule, event: WorkflowEvent): boolean {
  if (!rule.filter) return true; // No filter = matches all

  const payload = event.payload || {};

  // Check loadStatusIn filter (for LOAD_STATUS_CHANGED events)
  if (rule.filter.loadStatusIn && payload.newStatus) {
    const newStatus = String(payload.newStatus);
    if (!rule.filter.loadStatusIn.includes(newStatus)) {
      return false;
    }
  }

  // Check customerIdIn filter
  if (rule.filter.customerIdIn && payload.customerId) {
    const customerId = String(payload.customerId);
    if (!rule.filter.customerIdIn.includes(customerId)) {
      return false;
    }
  }

  // Check driverTypeIn filter
  if (rule.filter.driverTypeIn && payload.driverType) {
    const normalized = String(payload.driverType).toLowerCase().replace('_', '');
    if (!rule.filter.driverTypeIn.some(dt => normalized.includes(dt))) {
      return false;
    }
  }

  // Check requiresFactoring filter
  if (rule.filter.requiresFactoring !== undefined && payload.isFactored !== undefined) {
    if (rule.filter.requiresFactoring !== Boolean(payload.isFactored)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine who to assign the task to
 */
function resolveAssignee(
  assignTo: string | undefined,
  event: WorkflowEvent,
  payload: Record<string, any>
): string | undefined {
  if (!assignTo) return undefined;

  switch (assignTo) {
    case 'LOAD_DRIVER':
      return payload.driverId;
    case 'CREATOR':
      return payload.createdBy;
    case 'DISPATCH':
    case 'ACCOUNTING':
    case 'OWNER':
      // These would need to be resolved to actual user IDs
      // For now, return undefined (unassigned)
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Trigger workflow - process an event and create tasks
 */
export async function triggerWorkflow(
  tenantId: string | null,
  event: WorkflowEvent
): Promise<Task[]> {
  const rules = loadWorkflowRules(tenantId);
  const createdTasks: Task[] = [];

  // Find matching rules
  const matchingRules = rules.filter(rule => {
    if (!rule.isEnabled) return false;
    if (rule.eventType !== event.type) return false;
    return matchesRuleFilter(rule, event);
  });

  // Process each matching rule
  for (const rule of matchingRules) {
    for (const action of rule.actions) {
      if (action.type !== 'CREATE_TASK') continue;

      // Generate dedupeKey
      const dedupeKey = generateDedupeKey(
        tenantId,
        event.entityType,
        event.entityId,
        action.templateKey
      );

      // Calculate due date
      const dueAt = action.dueOffsetMinutes
        ? new Date(Date.now() + action.dueOffsetMinutes * 60_000).toISOString()
        : undefined;

      // Resolve assignee
      const assignedTo = resolveAssignee(action.assignTo, event, event.payload || {});

      // Determine initial status (blocked if blockers exist)
      const status: Task['status'] = action.blockers && action.blockers.length > 0
        ? 'blocked'
        : 'pending';

      // Create task
      const task = createTaskIfNotExists(tenantId, {
        entityType: event.entityType as Task['entityType'],
        entityId: event.entityId,
        ruleId: rule.id,
        templateKey: action.templateKey,
        dedupeKey,
        title: action.title,
        description: action.description,
        priority: action.priority,
        status,
        dueAt,
        assignedTo,
        tags: action.tags || [],
        blockers: action.blockers || [],
        metadata: {
          eventId: event.id,
          eventType: event.type,
        },
      });

      if (task) {
        createdTasks.push(task);
      }
    }
  }

  return createdTasks;
}

/**
 * Create a workflow event object
 */
function createWorkflowEvent(
  tenantId: string,
  type: WorkflowEvent['type'],
  entityType: string,
  entityId: string,
  payload?: Record<string, any>
): WorkflowEvent {
  const occurredAt = new Date().toISOString();
  const eventKey = `${type}:${entityType}:${entityId}:${occurredAt}`;

  return {
    id: generateEventId(),
    tenantId,
    type,
    entityType,
    entityId,
    occurredAt,
    payload,
    eventKey,
  };
}

/**
 * Helper: Trigger workflow for load created
 */
export function triggerLoadCreated(tenantId: string, loadId: string, loadData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent(tenantId, 'LOAD_CREATED', 'load', loadId, {
    ...loadData,
    createdBy: loadData.createdBy,
  });
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for load status changed
 */
export function triggerLoadStatusChanged(
  tenantId: string,
  loadId: string,
  oldStatus: string,
  newStatus: string,
  loadData: Record<string, any>
): Promise<Task[]> {
  const event = createWorkflowEvent(tenantId, 'LOAD_STATUS_CHANGED', 'load', loadId, {
    oldStatus,
    newStatus,
    ...loadData,
  });
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for load delivered
 */
export function triggerLoadDelivered(tenantId: string, loadId: string, loadData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent(tenantId, 'LOAD_DELIVERED', 'load', loadId, {
    ...loadData,
  });
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for invoice created
 */
export function triggerInvoiceCreated(tenantId: string, invoiceId: string, invoiceData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent(tenantId, 'INVOICE_CREATED', 'invoice', invoiceId, {
    ...invoiceData,
  });
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for invoice overdue
 */
export function triggerInvoiceOverdue(tenantId: string, invoiceId: string, invoiceData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent(tenantId, 'INVOICE_OVERDUE', 'invoice', invoiceId, {
    ...invoiceData,
  });
  return triggerWorkflow(tenantId, event);
}

