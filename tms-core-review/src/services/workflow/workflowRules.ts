/**
 * Workflow Rules - Default Rules for TMS
 * 
 * These are the starter pack of workflow rules that create tasks
 * automatically when events occur.
 */

import { WorkflowRule, TaskPriority } from '../../types';

/**
 * Default workflow rules (can be stored in localStorage or Firestore later)
 */
export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  // Load Created
  {
    id: 'rule_load_created',
    name: 'Load Created - Initial Tasks',
    isEnabled: true,
    eventType: 'LOAD_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_ASSIGN_DRIVER',
        title: 'Assign driver to load',
        description: 'A new load has been created and needs a driver assignment.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 60, // Due in 1 hour
        assignTo: 'DISPATCH',
        tags: ['load', 'dispatch'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_SEND_RATE_CONFIRMATION',
        title: 'Send rate confirmation',
        description: 'Rate confirmation document needs to be sent to customer.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 120, // Due in 2 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'document'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_CONFIRM_PICKUP_APPT',
        title: 'Confirm pickup appointment',
        description: 'Confirm pickup appointment time with shipper.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 240, // Due in 4 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'pickup'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Load Status Changed to Dispatched
  {
    id: 'rule_load_dispatched',
    name: 'Load Dispatched - Follow-up Tasks',
    isEnabled: true,
    eventType: 'LOAD_STATUS_CHANGED',
    filter: {
      loadStatusIn: ['dispatched'],
    },
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_CONFIRM_PICKUP',
        title: 'Confirm pickup (same day)',
        description: 'Follow up to confirm pickup has occurred.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 30, // Due in 30 minutes
        assignTo: 'DISPATCH',
        tags: ['load', 'pickup'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_TRACK_IN_TRANSIT',
        title: 'Track in-transit update',
        description: 'Monitor load progress while in transit.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 1440, // Due in 24 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'tracking'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Load Delivered
  {
    id: 'rule_load_delivered',
    name: 'Load Delivered - Post-Delivery Tasks',
    isEnabled: true,
    eventType: 'LOAD_DELIVERED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_COLLECT_POD',
        title: 'Collect POD',
        description: 'Proof of Delivery document is required for invoicing.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 60, // Due in 1 hour
        assignTo: 'DISPATCH',
        tags: ['load', 'pod', 'document'],
        blockers: ['POD_REQUIRED'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_GENERATE_INVOICE',
        title: 'Generate invoice',
        description: 'Invoice should be generated for this delivered load.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 120, // Due in 2 hours
        assignTo: 'ACCOUNTING',
        tags: ['load', 'invoice', 'ar'],
        blockers: ['POD_REQUIRED'], // Blocked until POD is uploaded
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Invoice Created
  {
    id: 'rule_invoice_created',
    name: 'Invoice Created - AR Tasks',
    isEnabled: true,
    eventType: 'INVOICE_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_SEND_TO_CUSTOMER',
        title: 'Send invoice to customer',
        description: 'Invoice has been created and should be sent to customer.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 30, // Due in 30 minutes
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_START_AR_FOLLOWUP',
        title: 'Start AR follow-up cycle',
        description: 'Begin accounts receivable follow-up process.',
        priority: 'low' as TaskPriority,
        dueOffsetMinutes: 43200, // Due in 30 days (when invoice becomes due)
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar', 'followup'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Invoice Overdue
  {
    id: 'rule_invoice_overdue',
    name: 'Invoice Overdue - Escalation',
    isEnabled: true,
    eventType: 'INVOICE_OVERDUE',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_FOLLOWUP_OVERDUE',
        title: 'Follow up overdue invoice',
        description: 'Invoice is past due date and requires immediate attention.',
        priority: 'urgent' as TaskPriority,
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar', 'overdue', 'urgent'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Load workflow rules from localStorage (or Firestore later)
 */
export function loadWorkflowRules(tenantId: string | null): WorkflowRule[] {
  try {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    const storageKey = `${prefix}workflow_rules`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : DEFAULT_WORKFLOW_RULES;
    }
  } catch (error) {
    console.warn('Error loading workflow rules:', error);
  }
  
  // Return defaults if nothing stored
  return DEFAULT_WORKFLOW_RULES;
}

/**
 * Save workflow rules to localStorage
 */
export function saveWorkflowRules(tenantId: string | null, rules: WorkflowRule[]): void {
  try {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    const storageKey = `${prefix}workflow_rules`;
    localStorage.setItem(storageKey, JSON.stringify(rules));
  } catch (error) {
    console.error('Error saving workflow rules:', error);
  }
}

/**
 * Initialize workflow rules (first time setup)
 */
export function initializeWorkflowRules(tenantId: string | null): void {
  const existing = loadWorkflowRules(tenantId);
  if (existing.length === 0) {
    saveWorkflowRules(tenantId, DEFAULT_WORKFLOW_RULES);
  }
}

