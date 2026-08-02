import { describe, expect, it } from 'vitest';
import {
  calculateActualFactoringFees,
  calculateFactoringAccrual,
  calculateFactoringFees,
} from '../businessLogic';
import { Invoice, Load, LoadStatus } from '../../types';

const makeLoad = (partial: Partial<Load> & { id: string; grandTotal: number }): Load =>
  ({
    loadNumber: partial.id,
    status: LoadStatus.Delivered,
    rate: partial.grandTotal,
    miles: 100,
    createdAt: '2026-01-01',
    ...partial,
  }) as Load;

describe('BUG-019 calculateFactoringAccrual', () => {
  it('accrues 2.5% on unfactored revenue and keeps actual invoice fee (live reconciliation)', () => {
    // $2,857,040 total; $50,020 factored at 2.5% = $1,250.50; rest accrued
    const factoredLoad = makeLoad({
      id: 'TEST-INV',
      grandTotal: 50020,
      isFactored: true,
      factoringFeePercent: 2.5,
      factoringFee: 1250.5,
    });
    const unfactoredLoads = [
      makeLoad({ id: 'U1', grandTotal: 1_400_000 }),
      makeLoad({ id: 'U2', grandTotal: 1_407_020 }),
    ];
    const invoice = {
      id: 'inv-test',
      invoiceNumber: 'TEST',
      amount: 50020,
      isFactored: true,
      factoringFee: 1250.5,
      factoringFeePercent: 2.5,
      loadIds: ['TEST-INV'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const result = calculateFactoringAccrual(
      [factoredLoad, ...unfactoredLoads],
      [invoice],
      [{ id: 'fc1', feePercentage: 2.5 }]
    );

    expect(result.totalRevenue).toBe(2_857_040);
    expect(result.factoredRevenue).toBe(50_020);
    expect(result.unfactoredRevenue).toBe(2_807_020);
    expect(result.actualFees).toBe(1_250.5);
    expect(result.accruedFees).toBe(70_175.5); // 2,807,020 × 2.5%
    expect(result.total).toBe(71_426); // 2,857,040 × 2.5%
    expect(result.coveragePercent).toBeCloseTo(1.75, 2);
    expect(result.belowCoverageTarget).toBe(true);
    expect(result.coverageTargetPercent).toBe(100);
  });

  it('does not double-count accrued and actual fees for the same load', () => {
    const load = makeLoad({
      id: 'L1',
      grandTotal: 10000,
      isFactored: true,
      factoringFeePercent: 2.5,
    });
    const invoice = {
      id: 'inv1',
      invoiceNumber: 'A',
      amount: 10000,
      isFactored: true,
      factoringFee: 250,
      factoringFeePercent: 2.5,
      loadIds: ['L1'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const result = calculateFactoringAccrual([load], [invoice], [{ id: 'fc', feePercentage: 2.5 }]);
    expect(result.actualFees).toBe(250);
    expect(result.accruedFees).toBe(0);
    expect(result.total).toBe(250);
    expect(result.belowCoverageTarget).toBe(false);
    expect(result.coveragePercent).toBe(100);
  });

  it('replaces estimate with actual when a factoring record appears', () => {
    const load = makeLoad({ id: 'L1', grandTotal: 40000 });
    const companies = [{ id: 'fc', feePercentage: 2.5 }];

    const before = calculateFactoringAccrual([load], [], companies);
    expect(before.accruedFees).toBe(1000);
    expect(before.actualFees).toBe(0);
    expect(before.total).toBe(1000);

    const invoice = {
      id: 'inv1',
      invoiceNumber: 'FACTORED',
      amount: 40000,
      isFactored: true,
      factoringFee: 1000,
      factoringFeePercent: 2.5,
      loadIds: ['L1'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const after = calculateFactoringAccrual([load], [invoice], companies);
    expect(after.actualFees).toBe(1000);
    expect(after.accruedFees).toBe(0);
    expect(after.total).toBe(1000);
  });

  it('preserves historical invoice rate (3%) even when company default is 2.5%', () => {
    const load = makeLoad({ id: 'L1', grandTotal: 10000, isFactored: true });
    const invoice = {
      id: 'inv-hist',
      invoiceNumber: 'OLD',
      amount: 10000,
      isFactored: true,
      factoringFee: 300,
      factoringFeePercent: 3,
      loadIds: ['L1'],
      status: 'paid',
      createdAt: '2025-01-01',
    } as Invoice;

    const result = calculateFactoringAccrual(
      [load, makeLoad({ id: 'U1', grandTotal: 10000 })],
      [invoice],
      [{ id: 'fc', feePercentage: 2.5 }]
    );

    expect(result.actualFees).toBe(300); // historical 3%
    expect(result.accruedFees).toBe(250); // 10k × 2.5% default
    expect(result.total).toBe(550);
  });

  it('calculateFactoringFees wrapper returns accrual total', () => {
    const loads = [
      makeLoad({ id: 'A', grandTotal: 50020, isFactored: true }),
      makeLoad({ id: 'B', grandTotal: 2_807_020 }),
    ];
    const invoice = {
      id: 'inv',
      invoiceNumber: 'TEST',
      amount: 50020,
      isFactored: true,
      factoringFee: 1250.5,
      factoringFeePercent: 2.5,
      loadIds: ['A'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    expect(calculateFactoringFees(loads, [invoice], [{ id: 'fc', feePercentage: 2.5 }])).toBe(71_426);
    expect(calculateActualFactoringFees(loads, [invoice], [{ id: 'fc', feePercentage: 2.5 }])).toBe(1_250.5);
  });
});
