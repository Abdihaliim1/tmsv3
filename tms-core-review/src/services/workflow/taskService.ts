/**
 * Task Service - Task Management with Idempotency
 * 
 * Handles:
 * - Task creation with deduplication (idempotent)
 * - Task storage in localStorage (tenant-aware)
 * - Task ID generation from dedupeKey
 */

import { Task, NewTaskInput } from '../../types';
import { getTenantFromSubdomain } from '../../utils/tenant';

/**
 * Generate a stable task ID from dedupeKey using hash
 */
export function taskIdFromDedupeKey(dedupeKey: string): string {
  // Simple stable hash
  let h = 0;
  for (let i = 0; i < dedupeKey.length; i++) {
    h = ((h << 5) - h) + dedupeKey.charCodeAt(i);
    h = h & h; // Convert to 32bit integer
  }
  // Ensure positive and add prefix
  const hash = Math.abs(h).toString(16);
  return `task_${hash}`;
}

/**
 * Generate dedupeKey for a task
 */
export function generateDedupeKey(
  tenantId: string | null,
  entityType: string,
  entityId: string,
  templateKey: string
): string {
  const tenant = tenantId || 'default';
  return `${tenant}:${entityType}:${entityId}:${templateKey}`;
}

/**
 * Get storage key for tasks (tenant-aware)
 */
function getStorageKey(tenantId: string | null): string {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}tasks`;
}

/**
 * Load tasks from localStorage
 */
export function loadTasks(tenantId: string | null): Task[] {
  try {
    const storageKey = getStorageKey(tenantId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.warn('Error loading tasks from localStorage:', error);
  }
  return [];
}

/**
 * Save tasks to localStorage
 */
export function saveTasks(tenantId: string | null, tasks: Task[]): void {
  try {
    const storageKey = getStorageKey(tenantId);
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving tasks to localStorage:', error);
  }
}

/**
 * Create task if it doesn't already exist (idempotent)
 */
export function createTaskIfNotExists(
  tenantId: string | null,
  taskInput: NewTaskInput & { dedupeKey: string }
): Task | null {
  const tasks = loadTasks(tenantId);

  // Check if task with this dedupeKey already exists
  const existing = tasks.find(t => t.dedupeKey === taskInput.dedupeKey);
  if (existing) {
    return existing; // Already exists, return it
  }

  // Generate ID from dedupeKey
  const id = taskIdFromDedupeKey(taskInput.dedupeKey);

  // Create new task
  const now = new Date().toISOString();
  const task: Task = {
    ...taskInput,
    id,
    tenantId: tenantId || undefined,
    createdAt: now,
    updatedAt: now,
    dueAt: taskInput.dueAt || taskInput.dueDate, // Support both fields
    dueDate: taskInput.dueDate || taskInput.dueAt, // Keep for backward compatibility
  };

  // Add to array and save
  tasks.push(task);
  saveTasks(tenantId, tasks);

  return task;
}

/**
 * Update an existing task
 */
export function updateTask(
  tenantId: string | null,
  taskId: string,
  updates: Partial<Task>
): Task | null {
  const tasks = loadTasks(tenantId);
  const index = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    console.warn(`Task ${taskId} not found`);
    return null;
  }

  // Update task
  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    // Sync dueAt and dueDate
    dueAt: updates.dueAt || tasks[index].dueAt || updates.dueDate,
    dueDate: updates.dueDate || tasks[index].dueDate || updates.dueAt,
  };

  saveTasks(tenantId, tasks);
  return tasks[index];
}

/**
 * Complete a task
 */
export function completeTask(
  tenantId: string | null,
  taskId: string,
  completedBy?: string
): Task | null {
  const now = new Date().toISOString();
  return updateTask(tenantId, taskId, {
    status: 'completed',
    completedAt: now,
    completedBy,
  });
}

/**
 * Assign a task
 */
export function assignTask(
  tenantId: string | null,
  taskId: string,
  assignedTo: string
): Task | null {
  return updateTask(tenantId, taskId, {
    assignedTo,
    status: 'in_progress', // Auto-set to in_progress when assigned
  });
}

/**
 * Get tasks by filter
 */
export function getTasks(
  tenantId: string | null,
  filters?: {
    status?: Task['status'];
    entityType?: string;
    entityId?: string;
    assignedTo?: string;
    priority?: Task['priority'];
  }
): Task[] {
  const tasks = loadTasks(tenantId);

  if (!filters) return tasks;

  return tasks.filter(task => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.entityType && task.entityType !== filters.entityType) return false;
    if (filters.entityId && task.entityId !== filters.entityId) return false;
    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    return true;
  });
}

/**
 * Delete a task
 */
export function deleteTask(tenantId: string | null, taskId: string): boolean {
  const tasks = loadTasks(tenantId);
  const filtered = tasks.filter(t => t.id !== taskId);
  
  if (filtered.length === tasks.length) {
    return false; // Task not found
  }

  saveTasks(tenantId, filtered);
  return true;
}

