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
import { calculateCompanyRevenue } from './utils';

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

/**
 * Resolve dispatcher commission for a load.
 * Prefers load fields, then falls back to the dispatcher's employee defaults.
 */
export function resolveDispatcherCommission(
  load: Load,
  dispatcher?: Employee | null
): { type?: DispatcherCommissionType; rate: number; amount: number; formula: string } {
  if (load.dispatcherCommissionAmount !== undefined && load.dispatcherCommissionAmount > 0) {
    return {
      type: load.dispatcherCommissionType,
      rate: load.dispatcherCommissionRate || 0,
      amount: load.dispatcherCommissionAmount,
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

  const baseRate = load.rate || 0;
  const miles = getLoadMiles(load);

  if (type === 'percentage') {
    const amount = baseRate * (rate / 100);
    return { type, rate, amount, formula: `$${baseRate.toFixed(2)} × ${rate}%` };
  }
  if (type === 'flat_fee') {
    return { type, rate, amount: rate, formula: `Flat $${rate.toFixed(2)}` };
  }
  if (type === 'per_mile') {
    const amount = miles * rate;
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

export function getLoadRevenue(load: Partial<Load>): number {
  const raw = load.grandTotal ?? load.rate ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function getLoadFsc(load: Partial<Load> & { fuelSurcharge?: number }): number {
  const raw = load.fscAmount ?? load.fuelSurcharge ?? 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Factoring fees from factored loads OR factored invoices (invoice is source of truth when loads weren't synced).
 */
export function calculateFactoringFees(
  loads: Load[],
  invoices: Invoice[],
  factoringCompanies: Array<{ id: string; feePercentage?: number }> = []
): number {
  const feeFromLoad = (load: Load): number => {
    if (load.factoringFee && load.factoringFee > 0) return load.factoringFee;
    const grandTotal = getLoadRevenue(load);
    if (grandTotal <= 0) return 0;
    let pct = load.factoringFeePercent;
    if ((!pct || pct === 0) && load.factoringCompanyId) {
      const company = factoringCompanies.find(fc => fc.id === load.factoringCompanyId);
      pct = company?.feePercentage;
    }
    if (!pct || pct === 0) pct = 2.5;
    return grandTotal * (pct / 100);
  };

  const factoredLoadIds = new Set<string>();
  let total = 0;

  loads.forEach(load => {
    if (!load.isFactored) return;
    factoredLoadIds.add(load.id);
    total += feeFromLoad(load);
  });

  invoices.forEach(invoice => {
    if (!invoice.isFactored) return;
    // Prefer stored invoice fee when present
    if (invoice.factoringFee && invoice.factoringFee > 0) {
      // Avoid double-counting loads already summed
      const invoiceLoadIds = [
        ...(invoice.loadId ? [invoice.loadId] : []),
        ...(invoice.loadIds || []),
      ];
      const allAlreadyCounted =
        invoiceLoadIds.length > 0 && invoiceLoadIds.every(id => factoredLoadIds.has(id));
      if (!allAlreadyCounted) {
        // If some loads missing isFactored, use invoice fee minus already-counted load fees
        if (invoiceLoadIds.every(id => !factoredLoadIds.has(id))) {
          total += invoice.factoringFee;
        }
      }
      return;
    }

    const invoiceLoadIds = [
      ...(invoice.loadId ? [invoice.loadId] : []),
      ...(invoice.loadIds || []),
    ];
    const invoiceFeePct = (() => {
      if (invoice.factoringCompanyId) {
        const company = factoringCompanies.find(fc => fc.id === invoice.factoringCompanyId);
        if (company?.feePercentage) return company.feePercentage;
      }
      return 2.5;
    })();

    if (invoiceLoadIds.length === 0) {
      total += (invoice.amount || 0) * (invoiceFeePct / 100);
      return;
    }

    invoiceLoadIds.forEach(loadId => {
      if (factoredLoadIds.has(loadId)) return;
      const load = loads.find(l => l.id === loadId);
      if (load) {
        factoredLoadIds.add(loadId);
        total += feeFromLoad({
          ...load,
          isFactored: true,
          factoringFeePercent: load.factoringFeePercent || invoiceFeePct,
          factoringCompanyId: load.factoringCompanyId || invoice.factoringCompanyId,
        });
      } else {
        const share = (invoice.amount || 0) / invoiceLoadIds.length;
        total += share * (invoiceFeePct / 100);
      }
    });
  });

  return total;
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
      byLoadId.set(load.id, { load, invoice });
    }
  });

  invoices.forEach(invoice => {
    if (!invoice.isFactored) return;
    const ids = [...(invoice.loadId ? [invoice.loadId] : []), ...(invoice.loadIds || [])];
    ids.forEach(loadId => {
      if (byLoadId.has(loadId)) return;
      const load = loads.find(l => l.id === loadId);
      if (load) {
        byLoadId.set(loadId, {
          load: {
            ...load,
            isFactored: true,
            factoringCompanyId: load.factoringCompanyId || invoice.factoringCompanyId,
            factoringCompanyName: load.factoringCompanyName || invoice.factoringCompanyName,
            factoringFeePercent: load.factoringFeePercent,
            factoringFee: load.factoringFee || invoice.factoringFee,
            factoredDate: load.factoredDate || invoice.factoredDate,
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
 * Calculate settlement gross pay from loads
 */
export function calculateSettlementGrossPay(
  loads: Load[],
  driver: Driver,
  settlementLoads: Array<{ loadId: string; basePay?: number; detention?: number; layover?: number; tonu?: number }>
): number {
  let grossPay = 0;

  settlementLoads.forEach(settlementLoad => {
    const load = loads.find(l => l.id === settlementLoad.loadId);
    if (!load) return;

    // Use settlement load values if available, otherwise calculate
    if (settlementLoad.basePay !== undefined) {
      grossPay += settlementLoad.basePay;
    } else {
      grossPay += calculateDriverBasePay(load, driver);
    }

    // Add accessorials (100% pass-through)
    grossPay += settlementLoad.detention || load.driverDetentionPay || 0;
    grossPay += settlementLoad.layover || load.driverLayoverPay || 0;
    grossPay += settlementLoad.tonu || (load as any).tonuFee || 0;
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

/**
 * Calculate period driver pay (from settlements or loads)
 */
export function calculatePeriodDriverPay(
  loads: Load[],
  settlements: Settlement[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  // Filter settlements by load delivery dates (not settlement creation date)
  const periodSettlements = settlements.filter(settlement => {
    if (settlement.type !== 'driver' && settlement.type) return false;
    
    const settlementLoadIds: string[] = [];
    if (settlement.loadId) settlementLoadIds.push(settlement.loadId);
    if (settlement.loadIds) settlementLoadIds.push(...settlement.loadIds);
    if (settlement.loads) {
      settlement.loads.forEach(l => {
        if (l.loadId && !settlementLoadIds.includes(l.loadId)) {
          settlementLoadIds.push(l.loadId);
        }
      });
    }

    if (settlementLoadIds.length === 0) return false;

    // Only include if ALL loads were delivered in period
    return settlementLoadIds.every(loadId => {
      const load = loads.find(l => l.id === loadId);
      if (!load) return false;
      const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
      if (isNaN(deliveryDate.getTime())) return false;
      return deliveryDate >= periodStart && deliveryDate <= periodEnd;
    });
  });

  let totalDriverPay = 0;
  periodSettlements.forEach(settlement => {
    const payeeId = (settlement as any).payeeId || settlement.driverId;
    const driver = drivers.find(d => d.id === payeeId);
    if (driver) {
      if (driver.type === 'OwnerOperator') {
        totalDriverPay += settlement.grossPay || 0;
      } else {
        totalDriverPay += settlement.netPay || 0;
      }
    }
  });

  // If no settlements, estimate from loads
  if (periodSettlements.length === 0) {
    const periodLoads = loads.filter(load => {
      const isDelivered = load.status === 'delivered' || load.status === 'completed';
      if (!isDelivered || !load.driverId) return false;
      const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
      if (isNaN(deliveryDate.getTime())) return false;
      return deliveryDate >= periodStart && deliveryDate <= periodEnd;
    });

    periodLoads.forEach(load => {
      const driver = drivers.find(d => d.id === load.driverId);
      if (driver) {
        totalDriverPay += calculateDriverPay(load, driver);
      }
    });
  }

  return totalDriverPay;
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

  // Only include company-paid expenses (exclude O/O pass-through)
  const companyExpenses = periodExpenses.filter(exp => {
    if (exp.paidBy !== 'company' && exp.paidBy !== 'tracked_only' && exp.paidBy) {
      return false;
    }
    
    // Exclude O/O pass-through expenses
    if (exp.driverId) {
      const driver = drivers.find(d => d.id === exp.driverId);
      if (driver && driver.type === 'OwnerOperator') {
        const expenseType = (exp.type || '').toLowerCase();
        const isPassThrough = 
          expenseType === 'fuel' || 
          expenseType === 'insurance' || 
          expenseType === 'toll' ||
          expenseType === 'maintenance';
        if (isPassThrough) return false;
      }
    }
    
    return true;
  });

  const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return revenue - driverPay - totalExpenses;
}


