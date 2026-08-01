import { describe, it, expect } from 'vitest';
import type { Load, Settlement } from '../../types';
import {
  allocateSettlementToPeriod,
  deriveSettlementPeriodFromLoads,
  settlementHasPeriodMismatch,
} from '../settlementPeriod';
import { parseDateOnlyLocal } from '../../utils/dateOnly';

const makeSettlement = (overrides: Partial<Settlement> = {}): Settlement =>
  ({
    id: 'st1',
    settlementNumber: 'ST-2026-1003',
    type: 'driver',
    driverId: 'd1',
    grossPay: 228124,
    netPay: 200749.12,
    totalDeductions: 27374.88,
    periodStart: '2026-07-27',
    periodEnd: '2026-08-02',
    loadIds: ['a', 'b', 'c'],
    loads: [
      { loadId: 'a', deliveryDate: '2026-02-09', basePay: 1000, companyGross: 1136 },
      { loadId: 'b', deliveryDate: '2026-07-22', basePay: 1000, companyGross: 1136 },
      { loadId: 'c', deliveryDate: '2026-07-28', basePay: 1000, companyGross: 1136 },
    ],
    ...overrides,
  }) as Settlement;

describe('settlementPeriod', () => {
  it('detects period mismatch for ST-2026-1003 style data', () => {
    expect(settlementHasPeriodMismatch(makeSettlement(), [])).toBe(true);
  });

  it('derives period from min/max load dates', () => {
    const bounds = deriveSettlementPeriodFromLoads(makeSettlement(), []);
    expect(bounds?.start).toBe('2026-02-09');
    expect(bounds?.end).toBe('2026-07-28');
  });

  it('does not attribute full net to a week with zero in-period loads', () => {
    const weekStart = parseDateOnlyLocal('2026-07-27');
    const weekEnd = parseDateOnlyLocal('2026-08-02');
    // Only load c (Jul 28) is in that week — 1/3 of pay
    const alloc = allocateSettlementToPeriod(makeSettlement(), [], weekStart, weekEnd);
    expect(alloc.inPeriod).toBe(true);
    expect(alloc.loadCountInPeriod).toBe(1);
    expect(alloc.share).toBeCloseTo(1 / 3, 5);
    expect(alloc.netShare).toBeCloseTo(200749.12 / 3, 0);
  });

  it('allocates zero when no loads fall in the report month', () => {
    const start = parseDateOnlyLocal('2026-01-01');
    const end = parseDateOnlyLocal('2026-01-31');
    const alloc = allocateSettlementToPeriod(makeSettlement(), [], start, end);
    expect(alloc.inPeriod).toBe(false);
    expect(alloc.netShare).toBe(0);
  });

  it('uses live load dates when snapshot dates missing', () => {
    const settlement = makeSettlement({
      loads: [
        { loadId: 'a', basePay: 500 },
        { loadId: 'b', basePay: 500 },
      ],
    });
    const live = [
      { id: 'a', deliveryDate: '2026-03-01' },
      { id: 'b', deliveryDate: '2026-03-15' },
    ] as Load[];
    const bounds = deriveSettlementPeriodFromLoads(settlement, live);
    expect(bounds?.start).toBe('2026-03-01');
    expect(bounds?.end).toBe('2026-03-15');
  });
});
