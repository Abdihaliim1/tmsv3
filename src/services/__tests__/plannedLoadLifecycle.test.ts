import { describe, expect, it } from 'vitest';
import {
  resolveLinkedPlannedLoads,
  resolvePlannedLoadsForTripCascade,
} from '../plannedLoadLifecycle';
import type { Load } from '../../types';
import type { PlannedLoad, Trip } from '../../types/plannedLoad';

const planned = (overrides: Partial<PlannedLoad> & { id: string }): PlannedLoad => ({
  id: overrides.id,
  systemLoadNumber: overrides.systemLoadNumber || `PL-${overrides.id}`,
  customLoadNumber: overrides.customLoadNumber,
  status: overrides.status || 'delivered',
  currentStep: overrides.currentStep || 4,
  pickups: [],
  deliveries: [],
  fees: {
    primaryFee: 1150,
    primaryFeeType: 'flat',
    fscAmount: 0,
    fscType: 'flat',
    accessoryFees: { detention: 0, lumper: 0, stopOff: 0, tarpFee: 0, additional: [] },
    invoiceAdvance: 0,
  },
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  tripId: overrides.tripId,
  tripNumber: overrides.tripNumber,
});

describe('plannedLoadLifecycle (BUG-018)', () => {
  it('resolves by plannedLoadId first', () => {
    const pl = planned({ id: 'bb04c976', customLoadNumber: 'QA-RETEST16-PAY-A', tripId: 'trip-a' });
    const load = {
      id: 'live-1',
      loadNumber: 'QA-RETEST16-PAY-A',
      plannedLoadId: 'bb04c976',
      tripId: 'trip-a',
    } as Load;

    expect(resolveLinkedPlannedLoads(load, [pl]).map(p => p.id)).toEqual(['bb04c976']);
  });

  it('falls back to load number + trip when plannedLoadId missing (legacy)', () => {
    const pl = planned({
      id: 'bb04c976',
      customLoadNumber: 'QA-RETEST16-PAY-A',
      systemLoadNumber: 'PL-OLD',
      tripId: 'trip-a',
      status: 'delivered',
    });
    const load = {
      id: 'live-1',
      loadNumber: 'QA-RETEST16-PAY-A',
      tripId: 'trip-a',
      notes: 'Created from Planned Load PL-OLD. Trip: QA-RETEST16-TRIP-A',
    } as Load;

    expect(resolveLinkedPlannedLoads(load, [pl]).map(p => p.id)).toEqual(['bb04c976']);
  });

  it('trip cascade deletes orphan planned loads when no live loads remain', () => {
    const pl = planned({
      id: 'bb04c976',
      customLoadNumber: 'QA-RETEST16-PAY-A',
      tripId: 'trip-a',
      tripNumber: 'QA-RETEST16-TRIP-A',
      status: 'delivered',
    });
    const trip = {
      id: 'trip-a',
      tripNumber: 'QA-RETEST16-TRIP-A',
      plannedLoadIds: ['bb04c976'],
    } as Trip;

    const orphans = resolvePlannedLoadsForTripCascade(trip, [pl], []);
    expect(orphans.map(p => p.id)).toEqual(['bb04c976']);
  });

  it('trip cascade keeps planned loads still linked to remaining live loads', () => {
    const plKeep = planned({ id: 'keep', customLoadNumber: 'KEEP-1', tripId: 'trip-a' });
    const plDrop = planned({ id: 'drop', customLoadNumber: 'DROP-1', tripId: 'trip-a' });
    const trip = {
      id: 'trip-a',
      tripNumber: 'T1',
      plannedLoadIds: ['keep', 'drop'],
    } as Trip;
    const remaining = [{
      id: 'live-keep',
      loadNumber: 'KEEP-1',
      plannedLoadId: 'keep',
      tripId: 'trip-a',
    } as Load];

    const orphans = resolvePlannedLoadsForTripCascade(trip, [plKeep, plDrop], remaining);
    expect(orphans.map(p => p.id)).toEqual(['drop']);
  });
});
