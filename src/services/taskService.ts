/**
 * Task Service - Workflow and Task Management
 * 
 * Handles:
 * - Automatic task creation on events
 * - Task lifecycle management
 * - Task assignment and tracking
 */

import { Load, Invoice, LoadStatus, Task, NewTaskInput } from '../types';
import { generateTaskId as generateId } from '../utils/idGenerator';

/**
 * Create tasks for a load based on its status
 */
export function createTasksForLoad(load: Load): NewTaskInput[] {
  const tasks: NewTaskInput[] = [];

  if (load.status === LoadStatus.Available) {
    tasks.push({
      type: 'load_created',
      entityType: 'load',
      entityId: load.id,
      title: `Assign driver to Load #${load.loadNumber}`,
      description: `Load #${load.loadNumber} is available and needs a driver assignment.`,
      priority: 'high',
      status: 'pending',
      dueDate: load.pickupDate,
      createdAt: new Date().toISOString()
    });

    tasks.push({
      type: 'rate_confirmation',
      entityType: 'load',
      entityId: load.id,
      title: `Send rate confirmation for Load #${load.loadNumber}`,
      description: `Rate confirmation document needs to be sent for Load #${load.loadNumber}.`,
      priority: 'medium',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }

  if (load.status === LoadStatus.Dispatched) {
    tasks.push({
      type: 'load_dispatched',
      entityType: 'load',
      entityId: load.id,
      title: `Confirm pickup for Load #${load.loadNumber}`,
      description: `Follow up to confirm pickup for Load #${load.loadNumber}.`,
      priority: 'high',
      status: 'pending',
      dueDate: load.pickupDate,
      createdAt: new Date().toISOString()
    });
  }

  if (load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed) {
    tasks.push({
      type: 'pod_request',
      entityType: 'load',
      entityId: load.id,
      title: `Request POD for Load #${load.loadNumber}`,
      description: `Proof of Delivery (POD) document is required for Load #${load.loadNumber}.`,
      priority: 'high',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    tasks.push({
      type: 'load_delivered',
      entityType: 'load',
      entityId: load.id,
      title: `Invoice customer for Load #${load.loadNumber}`,
      description: `Invoice should be generated for Load #${load.loadNumber}.`,
      priority: 'medium',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }

  return tasks;
}

/**
 * Create tasks for an invoice
 */
export function createTasksForInvoice(invoice: Invoice): NewTaskInput[] {
  const tasks: NewTaskInput[] = [];

  if (invoice.status === 'overdue') {
    tasks.push({
      type: 'invoice_overdue',
      entityType: 'invoice',
      entityId: invoice.id,
      title: `Follow up on overdue Invoice ${invoice.invoiceNumber}`,
      description: `Invoice ${invoice.invoiceNumber} for ${invoice.customerName} is overdue. Follow up required.`,
      priority: 'urgent',
      status: 'pending',
      dueDate: invoice.dueDate,
      createdAt: new Date().toISOString()
    });
  }

  return tasks;
}

/**
 * Generate task ID
 */
export function generateTaskId(): string {
  return generateId();
}


