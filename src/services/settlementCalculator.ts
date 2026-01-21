/**
 * Settlement Calculator Service
 *
 * Domain service for calculating driver and dispatcher settlements.
 * Centralizes all settlement-related business logic with validation.
 */

import { Load, Driver, Settlement, Expense, PaymentType } from '../types';
import { calculateDriverPay, calculateDriverBasePay } from './businessLogic';
import { generateSettlementNumber, generateSettlementId } from '../utils/idGenerator';

// ============================================================================
// Types
// ============================================================================

export interface SettlementLoadEntry {
  loadId: string;
  loadNumber?: string;
  basePay: number;
  detention: number;
  layover: number;
  tonu: number;
  totalPay: number;
  miles: number;
  deliveryDate?: string;
}

export interface DeductionBreakdown {
  insurance: number;
  ifta: number;
  cashAdvance: number;
  fuel: number;
  trailer: number;
  repairs: number;
  parking: number;
  form2290: number;
  eld: number;
  toll: number;
  irp: number;
  ucr: number;
  escrow: number;
  occupationalAccident: number;
  other: number;
  total: number;
}

export interface OtherEarning {
  type: string;
  description?: string;
  amount: number;
}

export interface SettlementCalculation {
  loads: SettlementLoadEntry[];
  totalMiles: number;
  grossPay: number;
  deductions: DeductionBreakdown;
  otherEarnings: OtherEarning[];
  totalOtherEarnings: number;
  netPay: number;
  effectiveRate: number; // Per mile rate (grossPay / totalMiles)
}

export interface SettlementInput {
  driverId: string;
  driver: Driver;
  loads: Load[];
  periodStart: string;
  periodEnd: string;
  deductions?: Partial<DeductionBreakdown>;
  otherEarnings?: OtherEarning[];
  expenses?: Expense[];
}

export interface SettlementValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate settlement input before calculation
 */
export function validateSettlementInput(input: SettlementInput): SettlementValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate driver
  if (!input.driver) {
    errors.push('Driver is required for settlement calculation');
  } else {
    // Check payment configuration
    const hasPayConfig =
      input.driver.payment?.type ||
      input.driver.rateOrSplit ||
      input.driver.payPercentage;

    if (!hasPayConfig) {
      errors.push(`Driver ${input.driver.firstName} ${input.driver.lastName} has no payment configuration`);
    }
  }

  // Validate loads
  if (!input.loads || input.loads.length === 0) {
    errors.push('At least one load is required for settlement');
  } else {
    // Check for undelivered loads
    const undeliveredLoads = input.loads.filter(
      load => load.status !== 'delivered' && load.status !== 'completed'
    );
    if (undeliveredLoads.length > 0) {
      warnings.push(
        `${undeliveredLoads.length} load(s) are not yet delivered: ${undeliveredLoads.map(l => l.loadNumber).join(', ')}`
      );
    }

    // Check for loads already settled
    const settledLoads = input.loads.filter(load => load.settlementId);
    if (settledLoads.length > 0) {
      warnings.push(
        `${settledLoads.length} load(s) already have settlements: ${settledLoads.map(l => l.loadNumber).join(', ')}`
      );
    }

    // Check for loads assigned to different drivers
    const otherDriverLoads = input.loads.filter(
      load => load.driverId && load.driverId !== input.driverId
    );
    if (otherDriverLoads.length > 0) {
      errors.push(
        `${otherDriverLoads.length} load(s) are assigned to a different driver`
      );
    }
  }

  // Validate period
  if (!input.periodStart || !input.periodEnd) {
    errors.push('Settlement period start and end dates are required');
  } else {
    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (start > end) {
      errors.push('Period start date must be before end date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate load entry for settlement
 */
function calculateLoadEntry(load: Load, driver: Driver): SettlementLoadEntry {
  const basePay = calculateDriverBasePay(load, driver);
  const detention = load.driverDetentionPay || 0;
  const layover = load.driverLayoverPay || 0;
  const tonu = load.tonuFee || 0;

  return {
    loadId: load.id,
    loadNumber: load.loadNumber,
    basePay,
    detention,
    layover,
    tonu,
    totalPay: basePay + detention + layover + tonu,
    miles: load.miles || 0,
    deliveryDate: load.deliveryDate
  };
}

/**
 * Calculate deduction breakdown
 */
function calculateDeductions(
  deductions?: Partial<DeductionBreakdown>,
  expenses?: Expense[],
  driver?: Driver
): DeductionBreakdown {
  const result: DeductionBreakdown = {
    insurance: deductions?.insurance || 0,
    ifta: deductions?.ifta || 0,
    cashAdvance: deductions?.cashAdvance || 0,
    fuel: deductions?.fuel || 0,
    trailer: deductions?.trailer || 0,
    repairs: deductions?.repairs || 0,
    parking: deductions?.parking || 0,
    form2290: deductions?.form2290 || 0,
    eld: deductions?.eld || 0,
    toll: deductions?.toll || 0,
    irp: deductions?.irp || 0,
    ucr: deductions?.ucr || 0,
    escrow: deductions?.escrow || 0,
    occupationalAccident: deductions?.occupationalAccident || 0,
    other: deductions?.other || 0,
    total: 0
  };

  // Add expenses as deductions if applicable
  if (expenses && expenses.length > 0) {
    expenses.forEach(expense => {
      // Only include company-paid expenses that should be deducted
      if (expense.paidBy === 'company' && expense.status === 'approved') {
        switch (expense.type) {
          case 'fuel':
            result.fuel += expense.amount;
            break;
          case 'maintenance':
            result.repairs += expense.amount;
            break;
          case 'insurance':
            result.insurance += expense.amount;
            break;
          case 'toll':
            result.toll += expense.amount;
            break;
          default:
            result.other += expense.amount;
        }
      }
    });
  }

  // Calculate total
  result.total =
    result.insurance +
    result.ifta +
    result.cashAdvance +
    result.fuel +
    result.trailer +
    result.repairs +
    result.parking +
    result.form2290 +
    result.eld +
    result.toll +
    result.irp +
    result.ucr +
    result.escrow +
    result.occupationalAccident +
    result.other;

  return result;
}

/**
 * Calculate full settlement
 */
export function calculateSettlement(input: SettlementInput): SettlementCalculation {
  // Validate input
  const validation = validateSettlementInput(input);
  if (!validation.valid) {
    throw new Error(`Settlement validation failed: ${validation.errors.join(', ')}`);
  }

  // Calculate load entries
  const loadEntries = input.loads.map(load => calculateLoadEntry(load, input.driver));

  // Calculate totals
  const totalMiles = loadEntries.reduce((sum, entry) => sum + entry.miles, 0);
  const grossPay = loadEntries.reduce((sum, entry) => sum + entry.totalPay, 0);

  // Calculate deductions
  const deductions = calculateDeductions(input.deductions, input.expenses, input.driver);

  // Calculate other earnings
  const otherEarnings = input.otherEarnings || [];
  const totalOtherEarnings = otherEarnings.reduce((sum, e) => sum + e.amount, 0);

  // Calculate net pay
  const netPay = grossPay + totalOtherEarnings - deductions.total;

  // Calculate effective rate per mile
  const effectiveRate = totalMiles > 0 ? grossPay / totalMiles : 0;

  return {
    loads: loadEntries,
    totalMiles,
    grossPay,
    deductions,
    otherEarnings,
    totalOtherEarnings,
    netPay,
    effectiveRate
  };
}

/**
 * Create a settlement object ready for saving
 */
export function createSettlement(
  input: SettlementInput,
  calculation: SettlementCalculation,
  options?: { settlementNumber?: string; status?: Settlement['status'] }
): Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'> {
  const settlementNumber = options?.settlementNumber || generateSettlementNumber();

  return {
    settlementNumber,
    type: 'driver',
    driverId: input.driverId,
    driverName: `${input.driver.firstName} ${input.driver.lastName}`,
    payeeId: input.driverId,
    payeeName: `${input.driver.firstName} ${input.driver.lastName}`,
    payType: input.driver.payment?.type || 'percentage',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    period: {
      start: input.periodStart,
      end: input.periodEnd,
      display: formatPeriodDisplay(input.periodStart, input.periodEnd)
    },
    totalMiles: calculation.totalMiles,
    loadIds: input.loads.map(l => l.id),
    loads: calculation.loads.map(entry => ({
      loadId: entry.loadId,
      basePay: entry.basePay,
      detention: entry.detention,
      layover: entry.layover,
      tonu: entry.tonu
    })),
    expenseIds: input.expenses?.map(e => e.id) || [],
    grossPay: calculation.grossPay,
    totalDeductions: calculation.deductions.total,
    netPay: calculation.netPay,
    otherEarnings: calculation.otherEarnings,
    deductions: {
      insurance: calculation.deductions.insurance,
      ifta: calculation.deductions.ifta,
      cashAdvance: calculation.deductions.cashAdvance,
      fuel: calculation.deductions.fuel,
      trailer: calculation.deductions.trailer,
      repairs: calculation.deductions.repairs,
      parking: calculation.deductions.parking,
      form2290: calculation.deductions.form2290,
      eld: calculation.deductions.eld,
      toll: calculation.deductions.toll,
      irp: calculation.deductions.irp,
      ucr: calculation.deductions.ucr,
      escrow: calculation.deductions.escrow,
      occupationalAccident: calculation.deductions.occupationalAccident,
      other: calculation.deductions.other
    },
    status: options?.status || 'draft'
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format period display string
 */
function formatPeriodDisplay(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };

  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Calculate week number from date
 */
export function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

/**
 * Get settlement period for a given week
 */
export function getWeekPeriod(year: number, weekNumber: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (weekNumber - 1) * 7 - jan1.getDay();

  const start = new Date(year, 0, 1 + daysOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start, end };
}

/**
 * Get loads eligible for settlement (delivered, not yet settled)
 */
export function getEligibleLoadsForSettlement(
  loads: Load[],
  driverId: string,
  periodStart: Date,
  periodEnd: Date
): Load[] {
  return loads.filter(load => {
    // Must be assigned to this driver
    if (load.driverId !== driverId) return false;

    // Must be delivered or completed
    if (load.status !== 'delivered' && load.status !== 'completed') return false;

    // Must not already be settled
    if (load.settlementId) return false;

    // Must be within period
    const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
    if (isNaN(deliveryDate.getTime())) return false;

    return deliveryDate >= periodStart && deliveryDate <= periodEnd;
  });
}

/**
 * Summarize settlements for a period
 */
export function summarizeSettlements(settlements: Settlement[]): {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  count: number;
  avgPerSettlement: number;
} {
  const totalGross = settlements.reduce((sum, s) => sum + (s.grossPay || 0), 0);
  const totalDeductions = settlements.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);
  const totalNet = settlements.reduce((sum, s) => sum + (s.netPay || 0), 0);
  const count = settlements.length;
  const avgPerSettlement = count > 0 ? totalNet / count : 0;

  return {
    totalGross,
    totalDeductions,
    totalNet,
    count,
    avgPerSettlement
  };
}
