import { describe, expect, it } from 'vitest';
import {
  calculateLoadGrandTotal,
  calculatePeriodFinancials,
  getLoadRevenue,
  getMonthDateRange,
  isCompanyRecognizedExpense,
} from '../businessLogic';
import { Load, LoadStatus, Expense, Driver, Invoice, Settlement } from '../../types';

const makeLoad = (partial: Partial<Load> & { id: string }): Load =>
  ({
    loadNumber: partial.id,
    status: LoadStatus.Delivered,
    rate: 0,
    miles: 0,
    createdAt: '2026-07-01',
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

describe('getLoadRevenue / calculateLoadGrandTotal', () => {
  it('rebuilds rate + FSC + accessorials when grandTotal missing', () => {
    const load = makeLoad({
      id: 'L1',
      rate: 1950,
      fscAmount: 195,
      detentionAmount: 0,
    });
    expect(calculateLoadGrandTotal(load)).toBe(2145);
    expect(getLoadRevenue(load)).toBe(2145);
  });

  it('prefers stored grandTotal when present', () => {
    const load = makeLoad({ id: 'L1', rate: 1950, fscAmount: 195, grandTotal: 2145 });
    expect(getLoadRevenue(load)).toBe(2145);
  });
});

describe('isCompanyRecognizedExpense', () => {
  it('excludes rejected and non-positive amounts', () => {
    const rejected = {
      id: 'e1',
      date: '2026-07-01',
      type: 'fuel',
      description: 'Diesel',
      amount: 100,
      status: 'rejected',
      paidBy: 'company',
    } as Expense;
    const zero = { ...rejected, id: 'e2', status: 'approved', amount: 0 };
    expect(isCompanyRecognizedExpense(rejected)).toBe(false);
    expect(isCompanyRecognizedExpense(zero)).toBe(false);
  });

  it('excludes O/O pass-through fuel', () => {
    const oo = makeDriver('d1', 'OwnerOperator');
    const fuel = {
      id: 'e1',
      date: '2026-07-01',
      type: 'fuel',
      description: 'Diesel',
      amount: 200,
      status: 'approved',
      paidBy: 'company',
      driverId: 'd1',
    } as Expense;
    expect(isCompanyRecognizedExpense(fuel, [oo])).toBe(false);
  });
});

describe('calculatePeriodFinancials', () => {
  it('uses current-month booked revenue and excludes out-of-period factoring', () => {
    const driver = makeDriver('d1');
    const julyLoads = [
      makeLoad({
        id: 'L1',
        rate: 1950,
        fscAmount: 195,
        grandTotal: 2145,
        deliveryDate: '2026-07-15',
        driverId: 'd1',
        isFactored: true,
      }),
      makeLoad({
        id: 'L2',
        rate: 1950,
        fscAmount: 195,
        grandTotal: 2145,
        deliveryDate: '2026-07-20',
        driverId: 'd1',
        isFactored: true,
      }),
    ];
    // Outside period — must not affect July
    const janLoad = makeLoad({
      id: 'L3',
      rate: 5000,
      grandTotal: 5000,
      deliveryDate: '2026-01-10',
      status: LoadStatus.Delivered,
      isFactored: true,
    });

    const invoice = {
      id: 'INV1',
      invoiceNumber: 'TEST',
      amount: 4290,
      isFactored: true,
      factoringFee: 107.25,
      factoringFeePercent: 2.5,
      loadIds: ['L1', 'L2'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;

    const rejectedExpense = {
      id: 'e1',
      date: '2026-07-05',
      type: 'other',
      description: 'Rejected office',
      amount: 9999,
      status: 'rejected',
      paidBy: 'company',
    } as Expense;

    const { start, end } = getMonthDateRange(new Date(2026, 6, 15)); // July 2026
    const result = calculatePeriodFinancials({
      loads: [...julyLoads, janLoad],
      expenses: [rejectedExpense],
      settlements: [] as Settlement[],
      invoices: [invoice],
      factoringCompanies: [{ id: 'fc1', feePercentage: 2.5 }],
      drivers: [driver],
      periodStart: start,
      periodEnd: end,
    });

    expect(result.revenue).toBe(4290); // 2 × 2145
    expect(result.factoringFees).toBe(107.25); // 4290 × 2.5%
    expect(result.operatingExpenses).toBe(0); // rejected excluded
    expect(result.revenueLoads).toHaveLength(2);
  });
});
