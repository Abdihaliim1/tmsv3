import { describe, expect, it, vi } from 'vitest';
import {
  assertPersistedPlannedLoadId,
  buildNewPlannedLoad,
  createPlannedLoadPersisted,
  deletePlannedLoadPersisted,
  updatePlannedLoadPersisted,
} from '../plannedLoadPersistence';
import type { NewPlannedLoadInput, PlannedLoad } from '../../types';

const baseInput = (): NewPlannedLoadInput => ({
  customLoadNumber: 'QA-PL-001',
  customer: { id: 'c1', name: 'QA Broker' },
  pickups: [{
    id: 'p1',
    shipper: { id: 's1', name: 'Shipper', address: '1 Main', city: 'Columbus', state: 'OH', zipCode: '43215' },
    pickupDate: '2026-08-02',
  }],
  deliveries: [{
    id: 'd1',
    consignee: { id: 'k1', name: 'Consignee', address: '2 Oak', city: 'St Louis', state: 'MO', zipCode: '63101' },
    deliveryDate: '2026-08-03',
  }],
  fees: {
    primaryFee: 1000,
    primaryFeeType: 'flat',
    fscAmount: 0,
    fscType: 'flat',
    accessoryFees: { detention: 0, lumper: 0, stopOff: 0, tarpFee: 0, additional: [] },
    invoiceAdvance: 0,
  },
});

describe('plannedLoadPersistence', () => {
  it('create awaits Firestore save before returning persisted ID', async () => {
    const order: string[] = [];
    const save = vi.fn(async (_tenantId: string, pl: PlannedLoad) => {
      order.push('save');
      expect(pl.id).toBeTruthy();
      expect(pl.status).toBe('planned');
    });

    const created = await createPlannedLoadPersisted({
      tenantId: 'qa-audit',
      input: baseInput(),
      actorUid: 'user-1',
      save,
    });
    order.push('returned');

    expect(save).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['save', 'returned']);
    expect(created.id).toBeTruthy();
    expect(created.customLoadNumber).toBe('QA-PL-001');
    expect(created.createdBy).toBe('user-1');
  });

  it('create rolls back by throwing when save fails (caller must not keep optimistic state)', async () => {
    const save = vi.fn(async () => {
      throw new Error('Firestore unavailable');
    });

    await expect(
      createPlannedLoadPersisted({
        tenantId: 'qa-audit',
        input: baseInput(),
        save,
      })
    ).rejects.toThrow('Firestore unavailable');
  });

  it('rejects invalid date order before save (refresh-safe)', async () => {
    const save = vi.fn(async () => {});
    const bad = baseInput();
    bad.pickups[0].pickupDate = '2026-08-10';
    bad.deliveries[0].deliveryDate = '2026-08-01';

    await expect(
      createPlannedLoadPersisted({ tenantId: 'qa-audit', input: bad, save })
    ).rejects.toThrow(/Delivery date cannot be before pickup date/i);
    expect(save).not.toHaveBeenCalled();
  });

  it('edit preserves persisted document ID and awaits save', async () => {
    const existing = buildNewPlannedLoad(baseInput(), { id: 'pl-persisted-1', actorUid: 'u1' });
    const save = vi.fn(async (_t: string, pl: PlannedLoad) => {
      expect(pl.id).toBe('pl-persisted-1');
    });

    const updated = await updatePlannedLoadPersisted({
      tenantId: 'qa-audit',
      existing,
      updates: { customLoadNumber: 'QA-PL-001-EDIT', id: 'hijack-id' as string },
      save,
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(updated.id).toBe('pl-persisted-1');
    expect(updated.customLoadNumber).toBe('QA-PL-001-EDIT');
  });

  it('attachment-style update uses partial update path with same persisted ID', async () => {
    const existing = buildNewPlannedLoad(baseInput(), { id: 'pl-attach-1' });
    const save = vi.fn(async () => {});
    const partialUpdate = vi.fn(async (_t: string, id: string, updates: Record<string, unknown>) => {
      expect(id).toBe('pl-attach-1');
      expect(updates.rateConUrl).toBe('https://example.com/ratecon.pdf');
    });

    await updatePlannedLoadPersisted({
      tenantId: 'qa-audit',
      existing,
      updates: { rateConUrl: 'https://example.com/ratecon.pdf' },
      save,
      partialUpdate,
    });

    expect(partialUpdate).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('attachment guard fails for unpersisted / unknown IDs (plannedLoad not found)', () => {
    const persisted = [buildNewPlannedLoad(baseInput(), { id: 'pl-real' })];
    expect(() => assertPersistedPlannedLoadId(persisted, 'pl-real')).not.toThrow();
    expect(() => assertPersistedPlannedLoadId(persisted, 'ghost-id')).toThrow('plannedLoad not found');
    expect(() => assertPersistedPlannedLoadId([], 'anything')).toThrow('plannedLoad not found');
  });

  it('dispatch uses the same persisted ID returned from create', async () => {
    const save = vi.fn(async () => {});
    const created = await createPlannedLoadPersisted({
      tenantId: 'qa-audit',
      input: baseInput(),
      save,
    });

    // Simulate dispatch selecting the created document by ID
    const dispatchIds = [created.id];
    assertPersistedPlannedLoadId([created], dispatchIds[0]);
    expect(dispatchIds[0]).toBe(created.id);
  });

  it('delete awaits deleteFn and blocks dispatched loads', async () => {
    const planned = buildNewPlannedLoad(baseInput(), { id: 'pl-del' });
    const deleteFn = vi.fn(async () => {});
    await deletePlannedLoadPersisted({
      tenantId: 'qa-audit',
      plannedLoad: planned,
      deleteFn,
    });
    expect(deleteFn).toHaveBeenCalledWith('qa-audit', 'pl-del');

    await expect(
      deletePlannedLoadPersisted({
        tenantId: 'qa-audit',
        plannedLoad: { ...planned, status: 'dispatched' },
        deleteFn,
      })
    ).rejects.toThrow(/already been dispatched/i);
  });
});
