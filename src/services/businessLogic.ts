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

import { Load, Driver, Settlement, Invoice, Expense } from '../types';
import { calculateCompanyRevenue } from './utils';

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

  // PRIORITY 3: Calculate from driver's payment profile
  const loadRate = load.rate || load.grandTotal || 0;
  const loadMiles = load.miles || 0;

  // Owner Operator: use rateOrSplit or payPercentage
  if (driver.type === 'OwnerOperator') {
    const payPercentage = driver.payment?.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : (driver.rateOrSplit ? (driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit) : 0));
    
    if (payPercentage === 0) {
      console.warn(`[BUSINESS LOGIC] Owner Operator ${driver.firstName} ${driver.lastName} has no pay percentage configured. Pay = 0.`);
      return 0;
    }
    
    return loadRate * payPercentage;
  }

  // Company Driver: calculate based on payment type
  if (driver.payment?.type === 'percentage') {
    const payPercentage = driver.payment.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : 0);
    
    if (payPercentage === 0) {
      console.warn(`[BUSINESS LOGIC] Company Driver ${driver.firstName} ${driver.lastName} has no pay percentage configured. Pay = 0.`);
      return 0;
    }
    
    return loadRate * payPercentage;
  } else if (driver.payment?.type === 'per_mile') {
    const ratePerMile = driver.payment.perMileRate || 0;
    if (ratePerMile === 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no per-mile rate configured. Pay = 0.`);
      return 0;
    }
    return loadMiles * ratePerMile;
  } else if (driver.payment?.type === 'flat_rate') {
    const flatRate = driver.payment.flatRate || 0;
    if (flatRate === 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no flat rate configured. Pay = 0.`);
      return 0;
    }
    return flatRate;
  }

  // Fallback: use rateOrSplit or payPercentage if available (backward compatibility)
  if (driver.rateOrSplit || driver.payPercentage) {
    const payPercentage = driver.rateOrSplit
      ? (driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit)
      : (driver.payPercentage! > 1 ? driver.payPercentage! / 100 : driver.payPercentage!);
    return loadRate * payPercentage;
  }

  // NO HARDCODED FALLBACK - Return 0 if profile is missing
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

  // Calculate from driver's payment profile
  const loadRate = load.rate || load.grandTotal || 0;
  const loadMiles = load.miles || 0;

  if (driver.payment?.type === 'percentage') {
    const payPercentage = driver.payment.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : 0);
    return loadRate * payPercentage;
  } else if (driver.payment?.type === 'per_mile') {
    return (loadMiles || 0) * (driver.payment.perMileRate || 0);
  } else if (driver.payment?.type === 'flat_rate') {
    return driver.payment.flatRate || 0;
  }

  // Fallback to rateOrSplit
  if (driver.rateOrSplit) {
    const payPercentage = driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit;
    return loadRate * payPercentage;
  }

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
 */
export function calculateSettlementDeductions(settlement: Settlement): number {
  const deductions = settlement.deductions || {};
  
  return (
    (deductions.insurance || 0) +
    (deductions.ifta || 0) +
    (deductions.cashAdvance || 0) +
    (deductions.fuel || 0) +
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
    (deductions.other || 0)
  );
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


