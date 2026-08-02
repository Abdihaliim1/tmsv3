/**
 * Business Logic Service - Single Source of Truth for All Calculations
 * 
 * This module centralizes ALL business calculations to ensure consistency:
 * - Driver pay calculations (NO hardcoded fallbacks)
 * - Settlement math
 * - Invoice totals
 * - Reporting revenue/profit
 * 
 * CRITICAL: All pages MUST import from this module, not duplicate logic.
 */

import { Load, Driver, Settlement, Invoice, Expense, LoadStatus, PaymentType, Employee } from '../types';
import { tryParseDateOnlyLocal } from '../utils/dateOnly';
import { calculateCompanyRevenue } from './utils';

function coerceMoney(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type DispatcherCommissionType = 'percentage' | 'flat_fee' | 'per_mile';

/** Pull dispatcher assignment + default commission from an employee record. */
export function getDispatcherAssignmentFields(dispatcher: Employee | undefined | null): {
  dispatcherId: string;
  dispatcherName: string;
  dispatcherCommissionType?: DispatcherCommissionType;
  dispatcherCommissionRate: number;
} {
  if (!dispatcher) {
    return {
      dispatcherId: '',
      dispatcherName: '',
      dispatcherCommissionType: undefined,
      dispatcherCommissionRate: 0,
    };
  }
  const type =
    dispatcher.dispatcherCommissionType ||
    dispatcher.defaultCommissionType ||
    undefined;
  const rate =
    Number(dispatcher.dispatcherCommissionRate ?? dispatcher.defaultCommissionRate) || 0;
  return {
    dispatcherId: dispatcher.id,
    dispatcherName: `${dispatcher.firstName} ${dispatcher.lastName}`.trim(),
    dispatcherCommissionType: type,
    dispatcherCommissionRate: rate,
  };
}

export type CommissionBase = 'gross' | 'linehaul';

/** Gross (rate+FSC+accessorials) by default; linehaul = primary rate only. */
export function getDispatcherCommissionBaseAmount(
  load: Partial<Load>,
  dispatcher?: Employee | null
): { base: CommissionBase; amount: number } {
  const base: CommissionBase =
    load.dispatcherCommissionBase ||
    dispatcher?.commissionBase ||
    'gross';
  if (base === 'linehaul') {
    return { base, amount: roundMoney(coerceMoney(load.rate)) };
  }
  return { base, amount: getLoadRevenue(load) };
}

/**
 * Resolve dispatcher commission for a load.
 * Prefers stored load amount (unless ignoreStored), then load/employee type+rate.
 * Percentage commission defaults to Total Income / Gross Revenue.
 */
export function resolveDispatcherCommission(
  load: Load,
  dispatcher?: Employee | null,
  options?: { ignoreStored?: boolean }
): { type?: DispatcherCommissionType; rate: number; amount: number; formula: string; base?: CommissionBase } {
  if (
    !options?.ignoreStored &&
    load.dispatcherCommissionAmount !== undefined &&
    load.dispatcherCommissionAmount > 0
  ) {
    return {
      type: load.dispatcherCommissionType,
      rate: load.dispatcherCommissionRate || 0,
      amount: roundMoney(load.dispatcherCommissionAmount),
      formula: 'Stored commission',
    };
  }

  const type =
    load.dispatcherCommissionType ||
    dispatcher?.dispatcherCommissionType ||
    dispatcher?.defaultCommissionType;
  const rate =
    (load.dispatcherCommissionRate && load.dispatcherCommissionRate > 0
      ? load.dispatcherCommissionRate
      : undefined) ??
    (dispatcher?.dispatcherCommissionRate && dispatcher.dispatcherCommissionRate > 0
      ? dispatcher.dispatcherCommissionRate
      : undefined) ??
    (dispatcher?.defaultCommissionRate && dispatcher.defaultCommissionRate > 0
      ? dispatcher.defaultCommissionRate
      : 0);

  if (!type || !rate || rate <= 0) {
    return { type, rate: rate || 0, amount: 0, formula: 'No commission configured on load or dispatcher' };
  }

  const miles = getLoadMiles(load);
  const { base, amount: commissionBaseAmount } = getDispatcherCommissionBaseAmount(load, dispatcher);

  if (type === 'percentage') {
    const amount = roundMoney(commissionBaseAmount * (rate / 100));
    return {
      type,
      rate,
      amount,
      base,
      formula: `$${commissionBaseAmount.toFixed(2)} (${base}) × ${rate}%`,
    };
  }
  if (type === 'flat_fee') {
    return { type, rate, amount: roundMoney(rate), formula: `Flat $${rate.toFixed(2)}` };
  }
  if (type === 'per_mile') {
    const amount = roundMoney(miles * rate);
    return { type, rate, amount, formula: `${miles} mi × $${rate.toFixed(2)}` };
  }

  return { type, rate, amount: 0, formula: 'Unknown commission type' };
}

/** Enrich a load patch with dispatcher commission when assigning a dispatcher. */
export function withDispatcherCommission(
  loadOrPatch: Partial<Load>,
  dispatcher: Employee | undefined | null
): Partial<Load> {
  if (!dispatcher) return loadOrPatch;
  const assignment = getDispatcherAssignmentFields(dispatcher);
  const merged: Partial<Load> = {
    ...loadOrPatch,
    dispatcherId: assignment.dispatcherId,
    dispatcherName: assignment.dispatcherName,
  };
  if (!merged.dispatcherCommissionType && assignment.dispatcherCommissionType) {
    merged.dispatcherCommissionType = assignment.dispatcherCommissionType;
  }
  if (!(merged.dispatcherCommissionRate && merged.dispatcherCommissionRate > 0) && assignment.dispatcherCommissionRate > 0) {
    merged.dispatcherCommissionRate = assignment.dispatcherCommissionRate;
  }
  // Recalculate amount when we have type+rate
  const tempLoad = { ...loadOrPatch, ...merged } as Load;
  const resolved = resolveDispatcherCommission(tempLoad, dispatcher);
  if (resolved.amount > 0) {
    merged.dispatcherCommissionAmount = resolved.amount;
    merged.dispatcherCommissionType = resolved.type;
    merged.dispatcherCommissionRate = resolved.rate;
  }
  return merged;
}

/** Statuses that count as completed revenue loads in reports. */
export const REVENUE_LOAD_STATUSES: LoadStatus[] = [
  LoadStatus.Delivered,
  LoadStatus.DeliveredWithBOL,
  LoadStatus.Invoiced,
  LoadStatus.Paid,
  LoadStatus.Completed,
];

export function isRevenueLoadStatus(status?: string): boolean {
  return !!status && REVENUE_LOAD_STATUSES.includes(status as LoadStatus);
}

/** Coerce load miles (handles string/number and common aliases). */
export function getLoadMiles(load: Partial<Load> & { totalMiles?: number; distance?: number }): number {
  const raw = load.miles ?? load.totalMiles ?? load.distance ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Accessorial earnings on a load (detention, layover, lumper, TONU, other). */
export function getLoadAccessorials(load: Partial<Load>): number {
  return roundMoney(
    coerceMoney(load.detentionAmount) +
      coerceMoney(load.layoverAmount) +
      coerceMoney(load.lumperFee ?? load.lumperAmount) +
      coerceMoney(load.tonuFee) +
      coerceMoney(load.otherAccessorials)
  );
}

export function getLoadFsc(load: Partial<Load> & { fuelSurcharge?: number }): number {
  return coerceMoney(load.fscAmount ?? load.fuelSurcharge);
}

/** Booked grand total rebuilt from parts (P&L formula). */
export function calculateLoadGrandTotal(load: Partial<Load>): number {
  return roundMoney(coerceMoney(load.rate) + getLoadFsc(load) + getLoadAccessorials(load));
}

/**
 * Booked load revenue for reports/dashboard.
 * Prefers stored grandTotal when present; otherwise rate + FSC + accessorials.
 */
export function getLoadRevenue(load: Partial<Load>): number {
  const stored = coerceMoney(load.grandTotal);
  if (stored > 0) return roundMoney(stored);
  const computed = calculateLoadGrandTotal(load);
  if (computed > 0) return computed;
  return roundMoney(coerceMoney(load.rate));
}

/** Local business date for a load (delivery, else pickup). */
export function getLoadBusinessDate(load: Partial<Load>): Date | null {
  const raw = load.deliveryDate || load.pickupDate;
  if (!raw) return null;
  return tryParseDateOnlyLocal(String(raw));
}

/** Inclusive local calendar-month bounds. */
export function getMonthDateRange(ref: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function sumBookedRevenue(loads: Load[]): number {
  return roundMoney(loads.reduce((sum, load) => sum + getLoadRevenue(load), 0));
}

export function filterRevenueLoadsInPeriod(
  loads: Load[],
  periodStart: Date,
  periodEnd: Date
): Load[] {
  return loads.filter(load => {
    if (!isRevenueLoadStatus(load.status)) return false;
    const businessDate = getLoadBusinessDate(load);
    if (!businessDate) return false;
    return businessDate >= periodStart && businessDate <= periodEnd;
  });
}

/**
 * Company P&L expense recognition:
 * - exclude pending and rejected
 * - exclude non-positive amounts
 * - company / tracked_only / unset paidBy only
 * - exclude O/O pass-through (fuel, insurance, toll, maintenance, ELD)
 */
export function isCompanyRecognizedExpense(
  exp: Expense,
  drivers: Driver[] = []
): boolean {
  if (exp.status === 'pending' || exp.status === 'rejected') return false;
  const amount = coerceMoney(exp.amount);
  if (amount <= 0) return false;

  if (exp.paidBy !== 'company' && exp.paidBy !== 'tracked_only' && exp.paidBy) {
    return false;
  }

  if (exp.driverId) {
    const driver = drivers.find(d => d.id === exp.driverId);
    const isOwnerOperator =
      driver?.employeeType === 'owner_operator' ||
      String(driver?.type || '').replace(/[^a-z]/gi, '').toLowerCase() === 'owneroperator';
    if (isOwnerOperator) {
      const expenseType = (exp.type || '').toLowerCase();
      const category = (exp.category || '').toLowerCase();
      const description = (exp.description || '').toLowerCase();
      const isPassThrough =
        expenseType === 'fuel' ||
        expenseType === 'insurance' ||
        expenseType === 'toll' ||
        expenseType === 'maintenance' ||
        expenseType === 'repair' ||
        category === 'repair' ||
        category === 'maintenance' ||
        description.includes('eld') ||
        description.includes('repair');
      if (isPassThrough) return false;
    }
  }

  return true;
}

/** Default factoring fee when no company / invoice historical rate is available. */
export const DEFAULT_FACTORING_FEE_PERCENT = 2.5;
/** Business model assumes 100% of revenue is factored. */
export const DEFAULT_FACTORING_COVERAGE_TARGET_PERCENT = 100;

export type FactoringAccrualResult = {
  /** Actual fees from factored invoices/loads + accrued estimate on unfactored revenue. */
  total: number;
  /** Fees recognized from factored invoices/loads (historical rate preserved). */
  actualFees: number;
  /** Accrued estimate on revenue still awaiting a factoring record. */
  accruedFees: number;
  factoredRevenue: number;
  unfactoredRevenue: number;
  totalRevenue: number;
  coveragePercent: number;
  coverageTargetPercent: number;
  belowCoverageTarget: boolean;
  defaultFeePercent: number;
};

export type PeriodFinancials = {
  revenue: number;
  driverPay: number;
  operatingExpenses: number;
  factoringFees: number;
  factoringActualFees: number;
  factoringAccruedFees: number;
  factoredRevenue: number;
  unfactoredRevenue: number;
  factoringCoveragePercent: number;
  factoringCoverageTargetPercent: number;
  factoringBelowCoverageTarget: boolean;
  factoringDefaultPercent: number;
  dispatcherCost: number;
  dispatcherCostEstimated: boolean;
  netProfit: number;
  profitMargin: number;
  revenueLoads: Load[];
};

/**
 * Shared period P&L used by Dashboard / Analytics / Company Overview.
 * Revenue = booked grand total (rate + FSC + accessorials) for revenue-status loads.
 */
export function calculatePeriodFinancials(input: {
  loads: Load[];
  expenses: Expense[];
  settlements: Settlement[];
  invoices: Invoice[];
  factoringCompanies?: Array<{ id: string; feePercentage?: number }>;
  drivers: Driver[];
  /** All employees (drivers + dispatchers) — used for dispatcher commission accrual */
  employees?: Employee[];
  periodStart: Date;
  periodEnd: Date;
}): PeriodFinancials {
  const {
    loads,
    expenses,
    settlements,
    invoices,
    factoringCompanies = [],
    drivers,
    employees = drivers as unknown as Employee[],
    periodStart,
    periodEnd,
  } = input;

  const revenueLoads = filterRevenueLoadsInPeriod(loads, periodStart, periodEnd);
  const revenue = sumBookedRevenue(revenueLoads);
  const driverPay = calculateAccruedDriverPay(revenueLoads, settlements, drivers).total;

  const operatingExpenses = roundMoney(
    expenses
      .filter(exp => {
        if (!isCompanyRecognizedExpense(exp, drivers)) return false;
        const expDate = tryParseDateOnlyLocal(String(exp.date || exp.createdAt || ''));
        if (!expDate) return false;
        return expDate >= periodStart && expDate <= periodEnd;
      })
      .reduce((sum, exp) => sum + coerceMoney(exp.amount), 0)
  );

  const factoring = calculateFactoringAccrual(revenueLoads, invoices, factoringCompanies);
  const accruedDispatcher = calculateAccruedDispatcherCommission(
    revenueLoads,
    settlements,
    employees
  );
  const dispatcherCost = accruedDispatcher.total;

  const netProfit = roundMoney(
    revenue - operatingExpenses - factoring.total - dispatcherCost - driverPay
  );
  const profitMargin = revenue > 0 ? roundMoney((netProfit / revenue) * 100) : 0;

  return {
    revenue,
    driverPay,
    operatingExpenses,
    factoringFees: factoring.total,
    factoringActualFees: factoring.actualFees,
    factoringAccruedFees: factoring.accruedFees,
    factoredRevenue: factoring.factoredRevenue,
    unfactoredRevenue: factoring.unfactoredRevenue,
    factoringCoveragePercent: factoring.coveragePercent,
    factoringCoverageTargetPercent: factoring.coverageTargetPercent,
    factoringBelowCoverageTarget: factoring.belowCoverageTarget,
    factoringDefaultPercent: factoring.defaultFeePercent,
    dispatcherCost,
    dispatcherCostEstimated: accruedDispatcher.isEstimated,
    netProfit,
    profitMargin,
    revenueLoads,
  };
}

function invoiceLoadIds(invoice: Invoice): string[] {
  const ids = new Set<string>();
  if (invoice.loadId) ids.add(invoice.loadId);
  (invoice.loadIds || []).forEach(id => ids.add(id));
  return Array.from(ids);
}

/**
 * Per-load factoring fee. Never copies the full invoice/transaction fee onto a load.
 * Recomputes from load revenue × % when stored fee looks like a duplicated invoice total.
 */
export function resolveLoadFactoringFee(
  load: Load,
  invoice?: Invoice | null,
  factoringCompanies: Array<{ id: string; feePercentage?: number }> = []
): number {
  const revenue = getLoadRevenue(load);
  if (revenue <= 0) return 0;

  let pct =
    load.factoringFeePercent ||
    invoice?.factoringFeePercent ||
    0;
  if ((!pct || pct <= 0) && (load.factoringCompanyId || invoice?.factoringCompanyId)) {
    const companyId = load.factoringCompanyId || invoice?.factoringCompanyId;
    const company = factoringCompanies.find(fc => fc.id === companyId);
    pct = company?.feePercentage || 0;
  }
  if (!pct || pct <= 0) pct = DEFAULT_FACTORING_FEE_PERCENT;
  // Guard nonsense percents
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  // Always compute from amount × %. Never trust stored fees — corrupt data often
  // stamps the full invoice fee onto every load (e.g. $3,217.50 × 60).
  const computed = roundMoney(revenue * (pct / 100));
  const stored = Number(load.factoringFee) || 0;
  if (stored > 0 && Math.abs(stored - computed) < 0.02) return stored;
  return computed;
}

/** Resolve the configured default factoring % (company fee, else 2.5%). */
export function resolveDefaultFactoringPercent(
  factoringCompanies: Array<{ feePercentage?: number }> = []
): number {
  const withFee = factoringCompanies.find(fc => Number(fc.feePercentage) > 0);
  let pct = Number(withFee?.feePercentage);
  if (!Number.isFinite(pct) || pct <= 0) pct = DEFAULT_FACTORING_FEE_PERCENT;
  if (pct > 100) pct = 100;
  return pct;
}

function buildFactoredInvoiceByLoadId(invoices: Invoice[]): Map<string, Invoice> {
  const invoiceByLoadId = new Map<string, Invoice>();
  invoices.forEach(invoice => {
    if (!invoice.isFactored) return;
    invoiceLoadIds(invoice).forEach(id => {
      if (!invoiceByLoadId.has(id)) invoiceByLoadId.set(id, invoice);
    });
  });
  return invoiceByLoadId;
}

/**
 * Actual factoring fees for loads that already have a factoring record.
 * Preserves each invoice's historical fee / rate. Does not accrue estimates.
 *
 * When multiple period loads share one invoice, allocate that invoice's fee
 * by revenue share so cents stay consistent with the invoice total.
 * Does NOT inject orphan invoice fees when the period has no matching loads.
 */
export function calculateActualFactoringFees(
  loads: Load[],
  invoices: Invoice[],
  factoringCompanies: Array<{ id: string; feePercentage?: number }> = []
): number {
  const invoiceByLoadId = buildFactoredInvoiceByLoadId(invoices);

  const byInvoice = new Map<string, { invoice: Invoice; loads: Load[] }>();
  const orphanLoads: Load[] = [];

  loads.forEach(load => {
    const invoice = invoiceByLoadId.get(load.id);
    const isFactored = !!(load.isFactored || invoice?.isFactored);
    if (!isFactored) return;
    if (invoice) {
      const key = invoice.id;
      const bucket = byInvoice.get(key) || { invoice, loads: [] };
      bucket.loads.push(load);
      byInvoice.set(key, bucket);
    } else {
      orphanLoads.push(load);
    }
  });

  let total = 0;

  byInvoice.forEach(({ invoice, loads: invLoads }) => {
    const invoiceRevenue = Number(invoice.amount) || invLoads.reduce((s, l) => s + getLoadRevenue(l), 0);
    // Prefer stored invoice fee (historical). Fall back to invoice historical %.
    let invoiceFee = Number(invoice.factoringFee) || 0;
    if (invoiceFee <= 0) {
      let pct = invoice.factoringFeePercent || 0;
      if ((!pct || pct <= 0) && invoice.factoringCompanyId) {
        pct = factoringCompanies.find(fc => fc.id === invoice.factoringCompanyId)?.feePercentage || 0;
      }
      if (!pct || pct <= 0) pct = resolveDefaultFactoringPercent(factoringCompanies);
      invoiceFee = invoiceRevenue * (pct / 100);
    }

    const periodRevenue = invLoads.reduce((s, l) => s + getLoadRevenue(l), 0);
    if (invoiceRevenue > 0 && periodRevenue > 0) {
      total += invoiceFee * (periodRevenue / invoiceRevenue);
    } else {
      invLoads.forEach(l => {
        total += resolveLoadFactoringFee(l, invoice, factoringCompanies);
      });
    }
  });

  orphanLoads.forEach(load => {
    total += resolveLoadFactoringFee(load, null, factoringCompanies);
  });

  return roundMoney(total);
}

/**
 * BUG-019: P&L factoring accrual.
 * - Actual fees from factored invoices/loads (historical rate preserved).
 * - Accrue default % against revenue still awaiting a factoring record.
 * - Never double-count: each load is either actual or accrued, not both.
 * - Warn when factored coverage is below the configured target (default 100%).
 */
export function calculateFactoringAccrual(
  loads: Load[],
  invoices: Invoice[],
  factoringCompanies: Array<{ id: string; feePercentage?: number }> = [],
  opts?: { coverageTargetPercent?: number; defaultFeePercent?: number }
): FactoringAccrualResult {
  const defaultFeePercent =
    opts?.defaultFeePercent ?? resolveDefaultFactoringPercent(factoringCompanies);
  const coverageTargetPercent =
    opts?.coverageTargetPercent ?? DEFAULT_FACTORING_COVERAGE_TARGET_PERCENT;

  const invoiceByLoadId = buildFactoredInvoiceByLoadId(invoices);
  const factoredLoads: Load[] = [];
  const unfactoredLoads: Load[] = [];

  loads.forEach(load => {
    const invoice = invoiceByLoadId.get(load.id);
    if (load.isFactored || invoice?.isFactored) {
      factoredLoads.push(load);
    } else {
      unfactoredLoads.push(load);
    }
  });

  const actualFees = calculateActualFactoringFees(factoredLoads, invoices, factoringCompanies);
  const factoredRevenue = roundMoney(sumBookedRevenue(factoredLoads));
  const unfactoredRevenue = roundMoney(sumBookedRevenue(unfactoredLoads));
  const totalRevenue = roundMoney(factoredRevenue + unfactoredRevenue);
  const accruedFees = roundMoney(unfactoredRevenue * (defaultFeePercent / 100));
  const total = roundMoney(actualFees + accruedFees);
  const coveragePercent =
    totalRevenue > 0 ? roundMoney((factoredRevenue / totalRevenue) * 100) : 100;
  const belowCoverageTarget = coveragePercent + 0.005 < coverageTargetPercent;

  return {
    total,
    actualFees,
    accruedFees,
    factoredRevenue,
    unfactoredRevenue,
    totalRevenue,
    coveragePercent,
    coverageTargetPercent,
    belowCoverageTarget,
    defaultFeePercent,
  };
}

/**
 * Factoring fees for period loads: actual + accrued estimate (no double-count).
 * Prefer calculateFactoringAccrual when the UI needs coverage / breakdown.
 */
export function calculateFactoringFees(
  loads: Load[],
  invoices: Invoice[],
  factoringCompanies: Array<{ id: string; feePercentage?: number }> = []
): number {
  return calculateFactoringAccrual(loads, invoices, factoringCompanies).total;
}

/** Loads that are factored either on the load record or via a factored invoice. */
export function getFactoredLoads(
  loads: Load[],
  invoices: Invoice[]
): Array<{ load: Load; invoice?: Invoice }> {
  const byLoadId = new Map<string, { load: Load; invoice?: Invoice }>();

  loads.forEach(load => {
    if (load.isFactored) {
      const invoice = invoices.find(
        inv => inv.loadIds?.includes(load.id) || inv.loadId === load.id
      );
      const fee = resolveLoadFactoringFee(load, invoice);
      byLoadId.set(load.id, {
        load: { ...load, factoringFee: fee },
        invoice,
      });
    }
  });

  invoices.forEach(invoice => {
    if (!invoice.isFactored) return;
    invoiceLoadIds(invoice).forEach(loadId => {
      if (byLoadId.has(loadId)) return;
      const load = loads.find(l => l.id === loadId);
      if (load) {
        const enriched: Load = {
          ...load,
          isFactored: true,
          factoringCompanyId: load.factoringCompanyId || invoice.factoringCompanyId,
          factoringCompanyName: load.factoringCompanyName || invoice.factoringCompanyName,
          factoringFeePercent: load.factoringFeePercent || invoice.factoringFeePercent,
          factoredDate: load.factoredDate || invoice.factoredDate,
        };
        byLoadId.set(loadId, {
          load: {
            ...enriched,
            factoringFee: resolveLoadFactoringFee(enriched, invoice),
          },
          invoice,
        });
      }
    });
  });

  return Array.from(byLoadId.values());
}

export interface ResolvedDriverPayment {
  type: PaymentType;
  perMileRate: number;
  /** Fraction 0–1 for percentage pay */
  percentageFraction: number;
  /** Display percent 0–100 */
  percentageDisplay: number;
  flatRate: number;
}

/**
 * Resolve driver pay type/rate from payment.* with legacy field fallbacks.
 * Heuristic: rateOrSplit ≤ 2 without an explicit % type → $/mi (e.g. 0.65).
 * rateOrSplit > 2 → percent (e.g. 65 or 88).
 */
export function resolveDriverPayment(driver: Driver): ResolvedDriverPayment {
  const payment = driver.payment;
  const explicitType = payment?.type;
  const perMileRate = Number(payment?.perMileRate) || 0;
  const flatRate = Number(payment?.flatRate) || 0;

  const rawPct =
    payment?.percentage !== undefined && payment.percentage !== null
      ? Number(payment.percentage)
      : driver.payPercentage !== undefined && driver.payPercentage !== null
        ? Number(driver.payPercentage)
        : NaN;

  const legacy = Number(driver.rateOrSplit ?? driver.payRate);
  const hasLegacy = Number.isFinite(legacy) && legacy > 0;

  if (explicitType === 'per_mile' || (!explicitType && perMileRate > 0)) {
    const rate = perMileRate > 0 ? perMileRate : (hasLegacy && legacy <= 2 ? legacy : 0);
    return { type: 'per_mile', perMileRate: rate, percentageFraction: 0, percentageDisplay: 0, flatRate: 0 };
  }

  if (explicitType === 'flat_rate') {
    return { type: 'flat_rate', perMileRate: 0, percentageFraction: 0, percentageDisplay: 0, flatRate };
  }

  if (explicitType === 'percentage' || driver.type === 'OwnerOperator') {
    let pct = Number.isFinite(rawPct) ? rawPct : (hasLegacy ? legacy : 0);
    // Owner operators often store 88 meaning 88%
    if (pct > 1) pct = pct / 100;
    return {
      type: 'percentage',
      perMileRate: 0,
      percentageFraction: pct,
      percentageDisplay: pct * 100,
      flatRate: 0,
    };
  }

  // Infer from legacy fields when payment.type is missing
  if (Number.isFinite(rawPct) && rawPct > 0) {
    const pct = rawPct > 1 ? rawPct / 100 : rawPct;
    return {
      type: 'percentage',
      perMileRate: 0,
      percentageFraction: pct,
      percentageDisplay: pct * 100,
      flatRate: 0,
    };
  }

  if (hasLegacy) {
    // ≤ 2 → typical per-mile; > 2 → percent points
    if (legacy <= 2) {
      return { type: 'per_mile', perMileRate: legacy, percentageFraction: 0, percentageDisplay: 0, flatRate: 0 };
    }
    const pct = legacy / 100;
    return {
      type: 'percentage',
      perMileRate: 0,
      percentageFraction: pct,
      percentageDisplay: legacy,
      flatRate: 0,
    };
  }

  return { type: 'per_mile', perMileRate: 0, percentageFraction: 0, percentageDisplay: 0, flatRate: 0 };
}

export function formatDriverPayRate(driver: Driver): string {
  const pay = resolveDriverPayment(driver);
  if (pay.type === 'per_mile') {
    return `$${pay.perMileRate.toFixed(2)}/mi`;
  }
  if (pay.type === 'percentage') {
    return `${pay.percentageDisplay.toFixed(pay.percentageDisplay % 1 === 0 ? 0 : 2)}%`;
  }
  if (pay.type === 'flat_rate') {
    return `$${pay.flatRate.toFixed(2)}/load`;
  }
  return '—';
}

/**
 * Calculate driver pay for a load based on driver's payment profile
 * 
 * PRIORITY ORDER:
 * 1. Use stored driverTotalGross from load (most accurate - calculated at delivery)
 * 2. Use stored driverBasePay + accessorials from load
 * 3. Calculate from driver's payment profile
 * 
 * NO HARDCODED FALLBACKS - If driver profile is missing, returns 0
 * 
 * @param load - The load to calculate pay for
 * @param driver - The driver assigned to the load
 * @returns Driver pay amount (0 if profile missing)
 */
export function calculateDriverPay(load: Load, driver?: Driver): number {
  if (!driver) return 0;

  // PRIORITY 1: Use stored driver pay from load (most accurate)
  if (load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
    return load.driverTotalGross;
  }

  // PRIORITY 2: Use stored base pay + accessorials
  if (load.driverBasePay !== undefined && load.driverBasePay > 0) {
    return load.driverBasePay + (load.driverDetentionPay || 0) + (load.driverLayoverPay || 0);
  }

  // PRIORITY 3: Calculate from resolved payment profile
  const loadRate = getLoadRevenue(load);
  const loadMiles = getLoadMiles(load);
  const pay = resolveDriverPayment(driver);

  if (pay.type === 'per_mile') {
    if (pay.perMileRate <= 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no per-mile rate configured. Pay = 0.`);
      return 0;
    }
    return loadMiles * pay.perMileRate;
  }

  if (pay.type === 'percentage') {
    if (pay.percentageFraction <= 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no pay percentage configured. Pay = 0.`);
      return 0;
    }
    return loadRate * pay.percentageFraction;
  }

  if (pay.type === 'flat_rate') {
    if (pay.flatRate <= 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no flat rate configured. Pay = 0.`);
      return 0;
    }
    return pay.flatRate;
  }

  console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} (ID: ${driver.id}) has no payment configuration. Pay = 0.`);
  return 0;
}

/**
 * Calculate driver base pay (before accessorials)
 */
export function calculateDriverBasePay(load: Load, driver?: Driver): number {
  if (!driver) return 0;

  // Use stored base pay if available
  if (load.driverBasePay !== undefined && load.driverBasePay > 0) {
    return load.driverBasePay;
  }

  const loadRate = getLoadRevenue(load);
  const loadMiles = getLoadMiles(load);
  const pay = resolveDriverPayment(driver);

  if (pay.type === 'per_mile') return loadMiles * pay.perMileRate;
  if (pay.type === 'percentage') return loadRate * pay.percentageFraction;
  if (pay.type === 'flat_rate') return pay.flatRate;
  return 0;
}

/**
 * Compute canonical stored driver pay fields for a load.
 * Percentage drivers: % of company gross (includes detention/FSC) — do NOT add accessorials again.
 * Per-mile / flat: base + detention + layover pass-through.
 */
export function computeStoredDriverPayFields(
  load: Load,
  driver?: Driver
): {
  driverBasePay: number;
  driverDetentionPay: number;
  driverLayoverPay: number;
  driverTotalGross: number;
} {
  if (!driver) {
    return {
      driverBasePay: 0,
      driverDetentionPay: 0,
      driverLayoverPay: 0,
      driverTotalGross: 0,
    };
  }

  const pay = resolveDriverPayment(driver);
  const scratch: Load = {
    ...load,
    driverBasePay: undefined,
    driverTotalGross: undefined,
    driverDetentionPay: undefined,
    driverLayoverPay: undefined,
  };
  const driverBasePay = calculateDriverBasePay(scratch, driver);
  const driverDetentionPay = coerceMoney(load.detentionAmount);
  const driverLayoverPay = coerceMoney(load.layoverAmount);

  if (pay.type === 'percentage') {
    return {
      driverBasePay,
      driverDetentionPay,
      driverLayoverPay,
      driverTotalGross: driverBasePay,
    };
  }

  return {
    driverBasePay,
    driverDetentionPay,
    driverLayoverPay,
    driverTotalGross: roundMoney(driverBasePay + driverDetentionPay + driverLayoverPay),
  };
}

/**
 * Calculate settlement gross pay from loads
 */
export function calculateSettlementGrossPay(
  loads: Load[],
  driver: Driver,
  settlementLoads: Array<{ loadId: string; basePay?: number; detention?: number; layover?: number; tonu?: number }>
): number {
  let grossPay = 0;
  const payProfile = resolveDriverPayment(driver);
  const percentageIncludesAccessorials = payProfile.type === 'percentage';

  settlementLoads.forEach(settlementLoad => {
    const load = loads.find(l => l.id === settlementLoad.loadId);
    if (!load) return;

    // Use settlement load values if available, otherwise calculate
    if (settlementLoad.basePay !== undefined) {
      grossPay += settlementLoad.basePay;
    } else {
      grossPay += calculateDriverBasePay(load, driver);
    }

    // Percentage of gross already includes accessorials — do not add again
    if (percentageIncludesAccessorials) return;

    // Add accessorials (100% pass-through for per-mile / flat)
    grossPay += settlementLoad.detention || load.driverDetentionPay || 0;
    grossPay += settlementLoad.layover || load.driverLayoverPay || 0;
    grossPay += settlementLoad.tonu || load.tonuFee || 0;
  });

  return grossPay;
}

/**
 * Calculate settlement total deductions
 * Includes `dispatch` (stored separately from `other`).
 * Does NOT treat TONU/layover/detention as deductions — those are earnings.
 */
export function calculateSettlementDeductions(settlement: Settlement): number {
  const deductions = settlement.deductions || {};

  const sum =
    (deductions.insurance || 0) +
    (deductions.ifta || 0) +
    (deductions.cashAdvance || 0) +
    (deductions.fuel || 0) +
    (deductions.dispatch || 0) +
    (deductions.trailer || 0) +
    (deductions.repairs || 0) +
    (deductions.parking || 0) +
    (deductions.form2290 || 0) +
    (deductions.eld || 0) +
    (deductions.toll || 0) +
    (deductions.irp || 0) +
    (deductions.ucr || 0) +
    (deductions.escrow || 0) +
    (deductions.occupationalAccident || 0) +
    (deductions.other || 0);

  return Math.round((sum + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate settlement net pay
 */
export function calculateSettlementNetPay(settlement: Settlement): number {
  const grossPay = settlement.grossPay || 0;
  const totalDeductions = calculateSettlementDeductions(settlement);
  const otherEarnings = (settlement.otherEarnings || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  
  return grossPay + otherEarnings - totalDeductions;
}

/**
 * Calculate invoice total from loads
 */
export function calculateInvoiceTotal(loads: Load[]): number {
  return loads.reduce((sum, load) => {
    return sum + (load.grandTotal || load.rate || 0);
  }, 0);
}

/**
 * Calculate invoice grand total (including taxes, fees, etc.)
 */
export function calculateInvoiceGrandTotal(invoice: Invoice): number {
  return invoice.amount || 0;
  // Future: Add tax, fees, discounts here if needed
}

/**
 * Calculate period revenue (filtered by delivery date)
 */
export function calculatePeriodRevenue(
  loads: Load[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  const periodLoads = loads.filter(load => {
    const isDelivered = load.status === 'delivered' || load.status === 'completed';
    if (!isDelivered) return false;
    
    const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
    if (isNaN(deliveryDate.getTime())) return false;
    return deliveryDate >= periodStart && deliveryDate <= periodEnd;
  });

  let totalRevenue = 0;
  periodLoads.forEach(load => {
    const grossAmount = load.grandTotal || load.rate || 0;
    if (load.driverId) {
      const driver = drivers.find(d => d.id === load.driverId);
      totalRevenue += calculateCompanyRevenue(grossAmount, driver);
    } else {
      totalRevenue += grossAmount;
    }
  });

  return totalRevenue;
}

export type AccruedDriverPayResult = {
  total: number;
  settled: number;
  unsettled: number;
  /** True when any load used an estimate (unsettled or settled without line pay). */
  isEstimated: boolean;
  byLoadId: Record<string, number>;
};

/**
 * Per-load driver pay for reporting:
 *   settled loads → settlement line pay (or estimate if line missing)
 *   unsettled loads → estimate from driver profile
 * Never drops unsettled loads just because some settlements exist.
 */
export function calculateAccruedDriverPay(
  revenueLoads: Load[],
  settlements: Settlement[],
  drivers: Driver[]
): AccruedDriverPayResult {
  const settledLinePay = new Map<string, number>();

  settlements.forEach(settlement => {
    if (settlement.type === 'dispatcher') return;
    (settlement.loads || []).forEach(entry => {
      if (!entry.loadId) return;
      const pay =
        (Number(entry.basePay) || 0) +
        (Number(entry.detention) || 0) +
        (Number(entry.layover) || 0) +
        (Number(entry.tonu) || 0);
      if (pay > 0) {
        settledLinePay.set(entry.loadId, roundMoney(pay));
      }
    });
  });

  let settled = 0;
  let unsettled = 0;
  let isEstimated = false;
  const byLoadId: Record<string, number> = {};

  revenueLoads.forEach(load => {
    if (!load.driverId) return;
    const driver = drivers.find(d => d.id === load.driverId);
    if (!driver) return;

    const linePay = settledLinePay.get(load.id);
    const isSettled = !!(load.settlementId || (linePay !== undefined && linePay > 0));

    let pay = 0;
    if (isSettled && linePay !== undefined && linePay > 0) {
      pay = linePay;
      settled += pay;
    } else if (isSettled) {
      isEstimated = true;
      pay = calculateDriverPay(load, driver);
      settled += pay;
    } else {
      isEstimated = true;
      pay = calculateDriverPay(load, driver);
      unsettled += pay;
    }
    byLoadId[load.id] = pay;
  });

  return {
    total: roundMoney(settled + unsettled),
    settled: roundMoney(settled),
    unsettled: roundMoney(unsettled),
    isEstimated,
    byLoadId,
  };
}

/**
 * Calculate period driver pay (settled lines + estimates for unsettled loads).
 */
export function calculatePeriodDriverPay(
  loads: Load[],
  settlements: Settlement[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  const periodLoads = loads.filter(load => {
    const isDelivered =
      load.status === 'delivered' ||
      load.status === 'completed' ||
      load.status === LoadStatus.Delivered ||
      load.status === LoadStatus.Completed;
    if (!isDelivered || !load.driverId) return false;
    const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
    if (isNaN(deliveryDate.getTime())) return false;
    return deliveryDate >= periodStart && deliveryDate <= periodEnd;
  });

  return calculateAccruedDriverPay(periodLoads, settlements, drivers).total;
}

export type AccruedDispatcherCommissionResult = {
  total: number;
  settled: number;
  unsettled: number;
  /** True when any load used an estimate (unsettled or $0 settlement line). */
  isEstimated: boolean;
  /** Per-load amounts used in the accrual (settlement snapshot or estimate). */
  byLoadId: Record<string, number>;
};

/**
 * Per-load dispatcher commission for P&L / overview:
 *   settled loads with settlement line pay → locked snapshot (never double-count estimate)
 *   unsettled (or $0 settlement lines) → estimate from employee/load rate on gross revenue
 */
export function calculateAccruedDispatcherCommission(
  revenueLoads: Load[],
  settlements: Settlement[],
  employees: Employee[]
): AccruedDispatcherCommissionResult {
  const settledLinePay = new Map<string, number>();

  settlements.forEach(settlement => {
    if (settlement.type !== 'dispatcher') return;
    (settlement.loads || []).forEach(entry => {
      if (!entry.loadId) return;
      const pay = coerceMoney(entry.basePay) || coerceMoney(entry.dispatchFee);
      if (pay > 0) {
        settledLinePay.set(entry.loadId, roundMoney(pay));
      }
    });
  });

  let settled = 0;
  let unsettled = 0;
  let isEstimated = false;
  const byLoadId: Record<string, number> = {};

  revenueLoads.forEach(load => {
    if (!load.dispatcherId) return;
    const dispatcher =
      employees.find(e => e.id === load.dispatcherId) ||
      null;

    const linePay = settledLinePay.get(load.id);
    if (linePay !== undefined && linePay > 0) {
      settled += linePay;
      byLoadId[load.id] = linePay;
      return;
    }

    // Unsettled, or locked to a $0 settlement — estimate on gross base (not $0 lock)
    isEstimated = true;
    const recomputed = resolveDispatcherCommission(load, dispatcher, { ignoreStored: true }).amount;
    const estimated =
      recomputed > 0
        ? recomputed
        : resolveDispatcherCommission(load, dispatcher, { ignoreStored: false }).amount;
    unsettled += estimated;
    byLoadId[load.id] = estimated;
  });

  return {
    total: roundMoney(settled + unsettled),
    settled: roundMoney(settled),
    unsettled: roundMoney(unsettled),
    isEstimated,
    byLoadId,
  };
}

/**
 * Calculate period profit (revenue - driver pay - expenses)
 */
export function calculatePeriodProfit(
  loads: Load[],
  expenses: Expense[],
  settlements: Settlement[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  const revenue = calculatePeriodRevenue(loads, periodStart, periodEnd, drivers);
  const driverPay = calculatePeriodDriverPay(loads, settlements, periodStart, periodEnd, drivers);
  
  // Filter expenses by date
  const periodExpenses = expenses.filter(exp => {
    const expenseDate = new Date(exp.date);
    if (isNaN(expenseDate.getTime())) return false;
    return expenseDate >= periodStart && expenseDate <= periodEnd;
  });

  const companyExpenses = periodExpenses.filter(exp =>
    isCompanyRecognizedExpense(exp, drivers)
  );

  const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return revenue - driverPay - totalExpenses;
}


