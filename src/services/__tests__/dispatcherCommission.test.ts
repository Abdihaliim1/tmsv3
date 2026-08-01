import { describe, expect, it } from 'vitest';
import {
  calculateAccruedDispatcherCommission,
  calculatePeriodFinancials,
  resolveDispatcherCommission,
  getMonthDateRange,
} from '../businessLogic';
import { Load, LoadStatus, Employee, Settlement, Driver, Invoice, Expense } from '../../types';

const makeLoad = (partial: Partial<Load> & { id: string }): Load =>
  ({
    loadNumber: partial.id,
    status: LoadStatus.Delivered,
    rate: 0,
    miles: 100,
    createdAt: '2026-07-01',
    ...partial,
  }) as Load;

const makeDispatcher = (overrides: Partial<Employee> = {}): Employee =>
  ({
    id: 'disp1',
    firstName: 'Amina',
    lastName: 'Ali',
    employeeType: 'dispatcher',
    status: 'active',
    dispatcherCommissionType: 'percentage',
    dispatcherCommissionRate: 3,
    commissionBase: 'gross',
    ...overrides,
  }) as Employee;

describe('resolveDispatcherCommission', () => {
  it('uses gross revenue (rate + FSC) for percentage by default', () => {
    const load = makeLoad({
      id: 'L1',
      rate: 1950,
      fscAmount: 195,
      grandTotal: 2145,
      dispatcherId: 'disp1',
    });
    const result = resolveDispatcherCommission(load, makeDispatcher(), { ignoreStored: true });
    expect(result.amount).toBe(64.35); // 2145 × 3%
    expect(result.base).toBe('gross');
  });

  it('supports linehaul-only commission base', () => {
    const load = makeLoad({
      id: 'L1',
      rate: 1950,
      fscAmount: 195,
      grandTotal: 2145,
      dispatcherId: 'disp1',
    });
    const result = resolveDispatcherCommission(
      load,
      makeDispatcher({ commissionBase: 'linehaul' }),
      { ignoreStored: true }
    );
    expect(result.amount).toBe(58.5); // 1950 × 3%
    expect(result.base).toBe('linehaul');
  });
});

describe('calculateAccruedDispatcherCommission', () => {
  it('estimates unsettled loads and uses settlement snapshot when settled', () => {
    const dispatcher = makeDispatcher();
    const loads = [
      makeLoad({
        id: 'L1',
        rate: 10000,
        grandTotal: 10000,
        deliveryDate: '2026-07-10',
        dispatcherId: 'disp1',
      }),
      makeLoad({
        id: 'L2',
        rate: 5000,
        grandTotal: 5000,
        deliveryDate: '2026-07-12',
        dispatcherId: 'disp1',
        dispatcherSettlementId: 'S1',
      }),
    ];
    const settlements = [
      {
        id: 'S1',
        type: 'dispatcher',
        loads: [{ loadId: 'L2', basePay: 200, dispatchFee: 200 }],
        loadIds: ['L2'],
        grossPay: 200,
        netPay: 200,
      },
    ] as Settlement[];

    const accrued = calculateAccruedDispatcherCommission(loads, settlements, [dispatcher]);
    expect(accrued.settled).toBe(200);
    expect(accrued.unsettled).toBe(300); // 10000 × 3%
    expect(accrued.total).toBe(500);
    expect(accrued.isEstimated).toBe(true);
  });

  it('does not treat $0 dispatcher settlement as locked cost (re-estimates)', () => {
    const dispatcher = makeDispatcher();
    const loads = [
      makeLoad({
        id: 'L1',
        rate: 21450,
        grandTotal: 21450,
        deliveryDate: '2026-07-15',
        dispatcherId: 'disp1',
        dispatcherSettlementId: 'DSP-ZERO',
      }),
    ];
    const settlements = [
      {
        id: 'DSP-ZERO',
        type: 'dispatcher',
        settlementNumber: 'DSP-2026-1002',
        loads: [{ loadId: 'L1', basePay: 0, dispatchFee: 0 }],
        loadIds: ['L1'],
        grossPay: 0,
        netPay: 0,
      },
    ] as Settlement[];

    const accrued = calculateAccruedDispatcherCommission(loads, settlements, [dispatcher]);
    expect(accrued.total).toBe(643.5); // 21450 × 3%
    expect(accrued.isEstimated).toBe(true);
  });
});

describe('calculatePeriodFinancials includes dispatcher commission', () => {
  it('subtracts estimated dispatcher commission from net profit', () => {
    const driver = {
      id: 'd1',
      firstName: 'Ahmed',
      lastName: 'Driver',
      type: 'Company',
      status: 'active',
      employeeType: 'driver',
      payment: { type: 'percentage', percentage: 0.35 },
      payPercentage: 35,
    } as Driver;
    const dispatcher = makeDispatcher();
    const load = makeLoad({
      id: 'L1',
      rate: 19500,
      fscAmount: 1950,
      grandTotal: 21450,
      deliveryDate: '2026-07-15',
      driverId: 'd1',
      dispatcherId: 'disp1',
      isFactored: true,
    });
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'JULY',
      amount: 21450,
      isFactored: true,
      factoringFeePercent: 2.5,
      loadIds: ['L1'],
      status: 'pending',
      createdAt: '2026-07-01',
    } as Invoice;
    const expense = {
      id: 'e1',
      date: '2026-07-05',
      type: 'fuel',
      category: 'fuel',
      description: 'Diesel',
      amount: 1975,
      status: 'approved',
      paidBy: 'company',
    } as Expense;

    const { start, end } = getMonthDateRange(new Date(2026, 6, 15));
    const result = calculatePeriodFinancials({
      loads: [load],
      expenses: [expense],
      settlements: [],
      invoices: [invoice],
      factoringCompanies: [{ id: 'fc1', feePercentage: 2.5 }],
      drivers: [driver],
      employees: [driver as unknown as Employee, dispatcher],
      periodStart: start,
      periodEnd: end,
    });

    expect(result.revenue).toBe(21450);
    expect(result.dispatcherCost).toBe(643.5);
    expect(result.dispatcherCostEstimated).toBe(true);
    expect(result.factoringFees).toBe(536.25);
    // driver 35% of 21450 = 7507.5
    expect(result.driverPay).toBe(7507.5);
    expect(result.operatingExpenses).toBe(1975);
    expect(result.netProfit).toBe(10787.75);
  });
});
