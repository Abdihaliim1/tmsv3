import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTaskIfNotExists,
  generateDedupeKey,
  loadTasks,
  reconcileTasks,
  saveTasks,
} from '../workflow/taskService';
import { Load, LoadStatus, Task } from '../../types';

const TENANT = 'test-tenant';

const makeLoad = (partial: Partial<Load> & { id: string }): Load =>
  ({
    loadNumber: partial.loadNumber || partial.id,
    status: LoadStatus.Delivered,
    rate: 1000,
    miles: 100,
    createdAt: '2026-07-01',
    ...partial,
  }) as Load;

beforeEach(() => {
  localStorage.clear();
});

describe('createTaskIfNotExists', () => {
  it('returns the same task for the same dedupeKey', () => {
    const key = generateDedupeKey(TENANT, 'load', 'L1', 'LOAD_COLLECT_POD');
    const first = createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_COLLECT_POD',
      dedupeKey: key,
      title: 'Collect POD',
      status: 'pending',
      priority: 'high',
    });
    const second = createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_COLLECT_POD',
      dedupeKey: key,
      title: 'Collect POD',
      status: 'pending',
      priority: 'high',
    });
    expect(first?.id).toBe(second?.id);
    expect(loadTasks(TENANT)).toHaveLength(1);
  });

  it('matches open logical duplicates without exact dedupeKey', () => {
    saveTasks(TENANT, [
      {
        id: 'legacy-1',
        entityType: 'load',
        entityId: 'L1',
        templateKey: 'LOAD_GENERATE_INVOICE',
        dedupeKey: 'old-key',
        title: 'Generate invoice',
        status: 'blocked',
        priority: 'medium',
        createdAt: '2026-07-01',
      } as Task,
    ]);

    const created = createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_GENERATE_INVOICE',
      dedupeKey: generateDedupeKey(TENANT, 'load', 'L1', 'LOAD_GENERATE_INVOICE'),
      title: 'Generate invoice',
      status: 'pending',
      priority: 'medium',
    });

    expect(created?.id).toBe('legacy-1');
    expect(loadTasks(TENANT)).toHaveLength(1);
  });
});

describe('reconcileTasks', () => {
  it('completes POD and invoice tasks when load is invoiced', () => {
    const keyPod = generateDedupeKey(TENANT, 'load', 'L1', 'LOAD_COLLECT_POD');
    const keyInv = generateDedupeKey(TENANT, 'load', 'L1', 'LOAD_GENERATE_INVOICE');
    createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_COLLECT_POD',
      dedupeKey: keyPod,
      title: 'Collect POD',
      status: 'blocked',
      priority: 'high',
      blockers: ['POD_REQUIRED'],
    });
    createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_GENERATE_INVOICE',
      dedupeKey: keyInv,
      title: 'Generate invoice',
      status: 'blocked',
      priority: 'medium',
      blockers: ['POD_REQUIRED'],
    });

    const load = makeLoad({
      id: 'L1',
      status: LoadStatus.Invoiced,
      invoiceId: 'INV1',
    });

    const result = reconcileTasks(TENANT, { loads: [load] });
    const pod = result.find(t => t.templateKey === 'LOAD_COLLECT_POD');
    const inv = result.find(t => t.templateKey === 'LOAD_GENERATE_INVOICE');
    expect(pod?.status).toBe('completed');
    expect(inv?.status).toBe('completed');
  });

  it('unblocks invoice task when POD exists but not yet invoiced', () => {
    const keyInv = generateDedupeKey(TENANT, 'load', 'L1', 'LOAD_GENERATE_INVOICE');
    createTaskIfNotExists(TENANT, {
      entityType: 'load',
      entityId: 'L1',
      templateKey: 'LOAD_GENERATE_INVOICE',
      dedupeKey: keyInv,
      title: 'Generate invoice',
      status: 'blocked',
      priority: 'medium',
      blockers: ['POD_REQUIRED'],
    });

    const load = makeLoad({
      id: 'L1',
      status: LoadStatus.Delivered,
      documents: [{
        id: 'd1',
        type: 'POD',
        name: 'pod.pdf',
        url: 'https://example.com/pod.pdf',
        uploadedAt: '2026-07-15',
      }],
    });

    const result = reconcileTasks(TENANT, { loads: [load] });
    const inv = result.find(t => t.templateKey === 'LOAD_GENERATE_INVOICE');
    expect(inv?.status).toBe('pending');
    expect(inv?.blockers || []).toHaveLength(0);
  });

  it('collapses duplicate open tasks for the same logical key', () => {
    saveTasks(TENANT, [
      {
        id: 'a',
        entityType: 'load',
        entityId: 'L1',
        templateKey: 'LOAD_COLLECT_POD',
        dedupeKey: 'k1',
        title: 'Collect POD',
        status: 'blocked',
        priority: 'high',
        updatedAt: '2026-07-01T00:00:00.000Z',
      } as Task,
      {
        id: 'b',
        entityType: 'load',
        entityId: 'L1',
        templateKey: 'LOAD_COLLECT_POD',
        dedupeKey: 'k2',
        title: 'Collect POD',
        status: 'pending',
        priority: 'high',
        updatedAt: '2026-07-02T00:00:00.000Z',
      } as Task,
    ]);

    const load = makeLoad({ id: 'L1', status: LoadStatus.Delivered });
    const result = reconcileTasks(TENANT, { loads: [load] });
    const openPods = result.filter(
      t => t.templateKey === 'LOAD_COLLECT_POD' && t.status !== 'cancelled'
    );
    expect(openPods).toHaveLength(1);
  });
});
