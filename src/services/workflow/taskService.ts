/**
 * Task Service - Task Management with Idempotency
 *
 * Handles:
 * - Task creation with deduplication (idempotent)
 * - Shared Firestore storage + localStorage cache (tenant-aware)
 * - Reconciliation against live load/invoice state
 */

import { Task, NewTaskInput, Load, Invoice, LoadStatus } from '../../types';
import {
  loadTasksCollection,
  saveTask as saveTaskDoc,
  deleteTaskDoc,
} from '../firestoreService';

export function normalizeTenantId(tenantId: string | null | undefined): string {
  return tenantId || 'default';
}

/**
 * Generate a stable task ID from dedupeKey using hash
 */
export function taskIdFromDedupeKey(dedupeKey: string): string {
  let h = 0;
  for (let i = 0; i < dedupeKey.length; i++) {
    h = ((h << 5) - h) + dedupeKey.charCodeAt(i);
    h = h & h;
  }
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
  return `${normalizeTenantId(tenantId)}:${entityType}:${entityId}:${templateKey}`;
}

function getStorageKey(tenantId: string | null): string {
  return `tms_${normalizeTenantId(tenantId)}_tasks`;
}

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

function saveTasksLocal(tenantId: string | null, tasks: Task[]): void {
  try {
    const storageKey = getStorageKey(tenantId);
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving tasks to localStorage:', error);
  }
}

function syncTasksRemote(tenantId: string | null, tasks: Task[]): void {
  const tid = normalizeTenantId(tenantId);
  void Promise.all(
    tasks.map(task =>
      saveTaskDoc(tid, { ...task, tenantId: tid }).catch(err =>
        console.warn('Failed to sync task to Firestore', task.id, err)
      )
    )
  );
}

/** Persist tasks locally and sync to shared Firestore backend. */
export function saveTasks(tenantId: string | null, tasks: Task[]): void {
  saveTasksLocal(tenantId, tasks);
  syncTasksRemote(tenantId, tasks);
}

/**
 * Load tasks from Firestore, merge with local cache, and persist the union.
 * Call once on tenant bootstrap so multi-user Tasks share the same store.
 */
export async function hydrateTasksFromBackend(tenantId: string | null): Promise<Task[]> {
  const tid = normalizeTenantId(tenantId);
  const local = loadTasks(tid);
  let remote: Task[] = [];
  try {
    remote = await loadTasksCollection(tid);
  } catch (error) {
    console.warn('Failed to load tasks from Firestore; using local cache', error);
  }

  const byId = new Map<string, Task>();
  [...local, ...remote].forEach(task => {
    const existing = byId.get(task.id);
    if (!existing) {
      byId.set(task.id, task);
      return;
    }
    const existingTs = existing.updatedAt || existing.createdAt || '';
    const nextTs = task.updatedAt || task.createdAt || '';
    byId.set(task.id, nextTs >= existingTs ? task : existing);
  });

  const merged = Array.from(byId.values());
  try {
    localStorage.setItem(getStorageKey(tid), JSON.stringify(merged));
  } catch {
    /* ignore quota */
  }
  // Push any local-only tasks up so other users can see them
  const remoteIds = new Set(remote.map(t => t.id));
  void Promise.all(
    merged
      .filter(t => !remoteIds.has(t.id))
      .map(task =>
        saveTaskDoc(tid, { ...task, tenantId: tid }).catch(() => undefined)
      )
  );
  return merged;
}

function logicalTaskKey(task: Pick<Task, 'entityType' | 'entityId' | 'templateKey' | 'title'>): string {
  return `${task.entityType}:${task.entityId}:${task.templateKey || task.title || ''}`;
}

export function loadHasPod(load: Load): boolean {
  if (load.podNumber) return true;
  const documents = load.documents || [];
  return documents.some(d => {
    const type = String(d.type || '').toLowerCase();
    return type === 'pod' || type.includes('proof');
  });
}

export function isLoadInvoiced(load: Load): boolean {
  return !!(
    load.invoiceId ||
    load.status === LoadStatus.Invoiced ||
    load.status === LoadStatus.Paid
  );
}

const OPEN_STATUSES = new Set<Task['status']>(['pending', 'in_progress', 'blocked']);

/**
 * Create task if it doesn't already exist (idempotent)
 */
export function createTaskIfNotExists(
  tenantId: string | null,
  taskInput: NewTaskInput & { dedupeKey: string }
): Task | null {
  const tid = normalizeTenantId(tenantId);
  const tasks = loadTasks(tid);

  const byDedupe = tasks.find(t => t.dedupeKey === taskInput.dedupeKey);
  if (byDedupe) return byDedupe;

  // Fallback: same logical task without/mismatched dedupeKey
  const byLogical = tasks.find(
    t =>
      t.entityType === taskInput.entityType &&
      t.entityId === taskInput.entityId &&
      (t.templateKey || '') === (taskInput.templateKey || '') &&
      OPEN_STATUSES.has(t.status)
  );
  if (byLogical) return byLogical;

  // Also return completed/cancelled twin so we don't reopen
  const closedTwin = tasks.find(
    t =>
      t.entityType === taskInput.entityType &&
      t.entityId === taskInput.entityId &&
      (t.templateKey || '') === (taskInput.templateKey || '')
  );
  if (closedTwin) return closedTwin;

  let id = taskIdFromDedupeKey(taskInput.dedupeKey);
  if (tasks.some(t => t.id === id)) {
    id = `${id}_${Date.now().toString(36)}`;
  }

  const now = new Date().toISOString();
  const task: Task = {
    ...taskInput,
    id,
    tenantId: tid,
    createdAt: now,
    updatedAt: now,
    dueAt: taskInput.dueAt || taskInput.dueDate,
    dueDate: taskInput.dueDate || taskInput.dueAt,
  };

  tasks.push(task);
  saveTasks(tid, tasks);
  return task;
}

export function updateTask(
  tenantId: string | null,
  taskId: string,
  updates: Partial<Task>
): Task | null {
  const tid = normalizeTenantId(tenantId);
  const tasks = loadTasks(tid);
  const index = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    console.warn(`Task ${taskId} not found`);
    return null;
  }

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    dueAt: updates.dueAt || tasks[index].dueAt || updates.dueDate,
    dueDate: updates.dueDate || tasks[index].dueDate || updates.dueAt,
  };

  saveTasks(tid, tasks);
  return tasks[index];
}

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
    blockers: [],
  });
}

export function assignTask(
  tenantId: string | null,
  taskId: string,
  assignedTo: string
): Task | null {
  return updateTask(tenantId, taskId, {
    assignedTo,
    status: 'in_progress',
  });
}

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

export function deleteTask(tenantId: string | null, taskId: string): boolean {
  const tid = normalizeTenantId(tenantId);
  const tasks = loadTasks(tid);
  const filtered = tasks.filter(t => t.id !== taskId);

  if (filtered.length === tasks.length) {
    return false;
  }

  try {
    localStorage.setItem(getStorageKey(tid), JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
  void deleteTaskDoc(tid, taskId).catch(() => undefined);
  // Re-sync remaining without re-uploading deleted id via saveTasks
  void Promise.all(
    filtered.map(task =>
      saveTaskDoc(tid, { ...task, tenantId: tid }).catch(() => undefined)
    )
  );
  return true;
}

function completeOpenTask(task: Task, now: string): Task {
  return {
    ...task,
    status: 'completed',
    completedAt: now,
    updatedAt: now,
    blockers: [],
  };
}

function cancelOpenTask(task: Task, now: string): Task {
  return {
    ...task,
    status: 'cancelled',
    updatedAt: now,
    blockers: [],
  };
}

/**
 * Reconcile workflow tasks against live loads/invoices:
 * - collapse logical duplicates
 * - complete POD / invoice / assign-driver tasks when work is done
 * - unblock invoice tasks once POD exists
 */
export function reconcileTasks(
  tenantId: string | null,
  context: { loads: Load[]; invoices?: Invoice[] }
): Task[] {
  const tid = normalizeTenantId(tenantId);
  let tasks = loadTasks(tid);
  const now = new Date().toISOString();

  const loadById = new Map(context.loads.map(l => [l.id, l]));
  const loadByNumber = new Map(
    context.loads.filter(l => l.loadNumber).map(l => [l.loadNumber, l])
  );

  // Collapse duplicates by logical key — keep newest open task, else newest overall
  const groups = new Map<string, Task[]>();
  tasks.forEach(task => {
    const key = logicalTaskKey(task);
    const list = groups.get(key) || [];
    list.push(task);
    groups.set(key, list);
  });

  const dropIds = new Set<string>();
  groups.forEach(group => {
    if (group.length <= 1) return;
    const sorted = [...group].sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
    );
    const keeper =
      sorted.find(t => OPEN_STATUSES.has(t.status)) || sorted[0];
    sorted.forEach(t => {
      if (t.id !== keeper.id) dropIds.add(t.id);
    });
  });

  tasks = tasks
    .filter(t => !dropIds.has(t.id))
    .map(task => {
      if (!OPEN_STATUSES.has(task.status)) return task;
      if (task.entityType !== 'load') return task;

      const load = loadById.get(task.entityId) || loadByNumber.get(task.entityId);
      if (!load) return task;

      if (load.status === LoadStatus.Cancelled) {
        return cancelOpenTask(task, now);
      }

      const template = task.templateKey || '';
      const hasPod = loadHasPod(load);
      const invoiced = isLoadInvoiced(load);
      const pastDispatch =
        load.status === LoadStatus.Dispatched ||
        load.status === LoadStatus.InTransit ||
        load.status === LoadStatus.Delivered ||
        load.status === LoadStatus.DeliveredWithBOL ||
        load.status === LoadStatus.Completed ||
        load.status === LoadStatus.Invoiced ||
        load.status === LoadStatus.Paid;

      if (template === 'LOAD_ASSIGN_DRIVER' && load.driverId) {
        return completeOpenTask(task, now);
      }

      if (
        (template === 'LOAD_DISPATCH' ||
          template === 'DISPATCH_BLOCKED' ||
          template === 'LOAD_CONFIRM_PICKUP') &&
        pastDispatch
      ) {
        return completeOpenTask(task, now);
      }

      if (template === 'LOAD_COLLECT_POD') {
        if (hasPod || invoiced) return completeOpenTask(task, now);
        return {
          ...task,
          status: 'blocked',
          blockers: ['POD_REQUIRED'],
          updatedAt: now,
        };
      }

      if (template === 'LOAD_GENERATE_INVOICE' || template === 'INVOICE_BLOCKED') {
        if (invoiced) return completeOpenTask(task, now);
        if (!hasPod) {
          return {
            ...task,
            status: 'blocked',
            blockers: ['POD_REQUIRED'],
            updatedAt: now,
          };
        }
        return {
          ...task,
          status: task.status === 'in_progress' ? 'in_progress' : 'pending',
          blockers: [],
          updatedAt: now,
        };
      }

      return task;
    });

  // Reconcile is local-cache only; create/update/delete paths sync to Firestore
  saveTasksLocal(tid, tasks);
  return tasks;
}
