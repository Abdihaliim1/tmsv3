import { describe, expect, it } from 'vitest';
import {
  calculateAccruedDriverPay,
  calculateFactoringFees,
  resolveLoadFactoringFee,
} from '../businessLogic';
import { Load, LoadStatus, Invoice, Settlement, Driver } from '../../types';

const makeLoad = (partial: Partial<Load> & { id: string }): Load =>
  ({
    loadNumber: partial.id,
    status: LoadStatus.Delivered,
    rate: 0,
    miles: 0,
    createdAt: '2026-01-01',
    ...partial,
  }) as Load;

const makeDriver = (id: string, type: 'Company' | 'OwnerOperator' = 'Company'): Driver =>
  ({
    id,
    firstName: 'Test',
    lastName: 'Driver',
    type,
    status: 'active',
    employeeType: 'driver',
    payment: { type: 'percentage', percentage: 0.35 },
    payPercentage: 35,
  }) as Driver;

describe('resolveLoadFactoringFee', () => {
  it('computes load revenue × 2.5% when fee missing', () => {
    const load = makeLoad({ id: 'L1', grandTotal: 2145, isFactored: true });
    expect(resolveLoadFactoringFee(load)).toBe(53.63);
  });

  it('does not stamp full invoice fee on each multi-load invoice load', () => {
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'TEST',
      amount: 128700,
      isFactored: true,
      factoringFee: 3217.5,
      factoringFeePercent: 2.5,
      loadIds: Array.from({ length: 60 }, (_, i) => `L${i}`),
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const load = makeLoad({
      id: 'L0',
      grandTotal: 2145,
      isFactored: true,
      // Corrupt: full invoice fee copied onto load
      factoringFee: 3217.5,
    });

    const fee = resolveLoadFactoringFee(load, invoice);
    expect(fee).toBe(53.63); // 2145 × 2.5%
    expect(fee).not.toBe(3217.5);
  });
});

describe('calculateFactoringFees', () => {
  it('sums per-load fees for period loads only (empty period = $0)', () => {
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'TEST',
      amount: 150150,
      isFactored: true,
      factoringFee: 3753.75,
      factoringFeePercent: 2.5,
      loadIds: ['L1', 'L2'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    // Empty period loads → no fee leak
    expect(calculateFactoringFees([], [invoice])).toBe(0);

    const loads = [
      makeLoad({ id: 'L1', grandTotal: 75075, isFactored: true, factoringFee: 3753.75 }),
      makeLoad({ id: 'L2', grandTotal: 75075, isFactored: true, factoringFee: 3753.75 }),
    ];
    // Corrupt stored fees equal invoice total — allocate invoice fee by revenue share
    const total = calculateFactoringFees(loads, [invoice]);
    expect(total).toBe(3753.75);
  });

  it('matches $150,150 × 2.5% = $3,753.75 across many loads (no per-load fee repeat)', () => {
    const loadIds = Array.from({ length: 70 }, (_, i) => `L${i}`);
    const perLoad = 150150 / 70;
    const loads = loadIds.map(id =>
      makeLoad({
        id,
        grandTotal: perLoad,
        isFactored: true,
        factoringFee: 3753.75, // corrupt full invoice fee on every row
      })
    );
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'JUL',
      amount: 150150,
      isFactored: true,
      factoringFee: 3753.75,
      factoringFeePercent: 2.5,
      loadIds,
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const total = calculateFactoringFees(loads, [invoice]);
    expect(total).toBe(3753.75);
    // Bug was 70 × $3,217.50-style totals (~$198k); ensure we are nowhere near that
    expect(total).toBeLessThan(10000);
  });
});

describe('calculateAccruedDriverPay', () => {
  it('adds estimates for unsettled loads when a settlement already exists', () => {
    const driver = makeDriver('D1');
    const loads = [
      makeLoad({
        id: 'A',
        driverId: 'D1',
        rate: 2000,
        grandTotal: 2000,
        settlementId: 'S1',
        driverBasePay: 700,
      }),
      makeLoad({
        id: 'B',
        driverId: 'D1',
        rate: 2000,
        grandTotal: 2000,
        // unsettled
      }),
    ];
    const settlements: Settlement[] = [
      {
        id: 'S1',
        type: 'driver',
        driverId: 'D1',
        grossPay: 700,
        netPay: 500,
        loadIds: ['A'],
        loads: [{ loadId: 'A', basePay: 700 }],
        status: 'pending',
      },
    ];

    const result = calculateAccruedDriverPay(loads, settlements, [driver]);
    expect(result.settled).toBe(700);
    expect(result.unsettled).toBe(700); // 35% of 2000
    expect(result.total).toBe(1400);
  });

  it('does not drop unsettled pay when settlements.length > 0', () => {
    const driver = makeDriver('D1');
    const loads = Array.from({ length: 10 }, (_, i) =>
      makeLoad({
        id: `L${i}`,
        driverId: 'D1',
        rate: 1000,
        grandTotal: 1000,
        settlementId: i === 0 ? 'S1' : undefined,
        driverBasePay: i === 0 ? 350 : undefined,
      })
    );
    const settlements: Settlement[] = [
      {
        id: 'S1',
        type: 'driver',
        driverId: 'D1',
        grossPay: 350,
        netPay: 2865, // misleading settlement net — must not replace all load accrual
        loadIds: ['L0'],
        loads: [{ loadId: 'L0', basePay: 350 }],
        status: 'pending',
      },
    ];

    const result = calculateAccruedDriverPay(loads, settlements, [driver]);
    expect(result.settled).toBe(350);
    expect(result.unsettled).toBe(3150); // 9 × 350
    expect(result.total).toBe(3500);
  });
});
