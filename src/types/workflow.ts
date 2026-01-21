/**
 * Workflow & Task Types
 * 
 * Task management and workflow automation types.
 */

// ============================================================================
// Task Types
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  tenantId?: string;
  entityType: 'load' | 'invoice' | 'settlement' | 'driver' | 'expense' | 'truck' | 'customer';
  entityId: string;
  ruleId?: string;
  templateKey?: string;
  dedupeKey: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: string;
  createdBy?: string;
  completedAt?: string;
  completedBy?: string;
  tags?: string[];
  blockers?: string[];
  metadata?: Record<string, unknown>;
  type?: 'load_created' | 'load_dispatched' | 'load_delivered' | 'invoice_overdue' | 'pod_request' | 'rate_confirmation' | 'custom';
  dueDate?: string;
}

export type NewTaskInput = Omit<Task, 'id' | 'updatedAt' | 'dedupeKey'>;

// ============================================================================
// Workflow Event Types
// ============================================================================

export type WorkflowEventType =
  | 'LOAD_CREATED'
  | 'LOAD_STATUS_CHANGED'
  | 'LOAD_DELIVERED'
  | 'INVOICE_CREATED'
  | 'INVOICE_OVERDUE'
  | 'PAYMENT_POSTED'
  | 'DOCUMENT_UPLOADED'
  | 'SETTLEMENT_CREATED';

export interface WorkflowEvent {
  id: string;
  tenantId?: string;
  type: WorkflowEventType;
  entityType: string;
  entityId: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
  eventKey: string;
}

// ============================================================================
// Workflow Rule Types
// ============================================================================

export interface WorkflowRule {
  id: string;
  tenantId?: string;
  name: string;
  isEnabled: boolean;
  eventType: WorkflowEventType;
  filter?: {
    loadStatusIn?: string[];
    customerIdIn?: string[];
    driverTypeIn?: ('company' | 'owner_operator')[];
    requiresFactoring?: boolean;
  };
  actions: Array<{
    type: 'CREATE_TASK';
    templateKey: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    dueOffsetMinutes?: number;
    assignTo?: 'DISPATCH' | 'ACCOUNTING' | 'OWNER' | 'LOAD_DRIVER' | 'CREATOR';
    tags?: string[];
    blockers?: Array<'POD_REQUIRED' | 'BOL_REQUIRED' | 'RATECON_REQUIRED'>;
  }>;
  createdAt: string;
  updatedAt: string;
}
