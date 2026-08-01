/**
 * Settlement Types
 * 
 * Driver and dispatcher settlement/payroll types.
 */

import { PaymentType } from './shared';

// ============================================================================
// Settlement Interface
// ============================================================================

export interface Settlement {
  id: string;
  settlementNumber?: string;
  type: 'driver' | 'dispatcher';
  driverId?: string;
  driverName?: string;
  dispatcherId?: string;
  payeeId?: string;
  payeeName?: string;
  payType?: PaymentType;
  periodStart?: string;
  periodEnd?: string;
  period?: string | { start: string; end: string; display: string };
  weekNumber?: number;
  date?: string;
  totalMiles?: number;
  
  // Loads
  loadId?: string;
  loadIds?: string[];
  /** Immutable per-load snapshot used by PDF/detail (do not recalculate from live loads). */
  loads?: Array<{
    loadId: string;
    loadNumber?: string;
    deliveryDate?: string;
    pickupDate?: string;
    originCity?: string;
    originState?: string;
    destCity?: string;
    destState?: string;
    companyGross?: number;
    miles?: number;
    basePay?: number;
    detention?: number;
    layover?: number;
    tonu?: number;
    dispatchFee?: number;
    /** Immutable dispatcher commission metadata at settlement time */
    commissionType?: 'percentage' | 'flat_fee' | 'per_mile';
    commissionRate?: number;
    commissionBase?: 'gross' | 'linehaul';
  }>;
  /** Pay rate captured at generation time (per-mile $, percent as stored, or flat). */
  payRateSnapshot?: number;
  
  // Expenses
  expenseIds?: string[];
  
  // Financial
  grossPay: number;
  totalDeductions?: number;
  netPay?: number;
  
  otherEarnings?: Array<{
    type: string;
    description?: string;
    amount: number;
  }>;
  
  deductions?: {
    insurance?: number;
    ifta?: number;
    cashAdvance?: number;
    fuel?: number;
    /** Stored separately from `other` so detail views can show Dispatch vs Others. */
    dispatch?: number;
    trailer?: number;
    repairs?: number;
    parking?: number;
    form2290?: number;
    eld?: number;
    toll?: number;
    irp?: number;
    ucr?: number;
    escrow?: number;
    occupationalAccident?: number;
    /**
     * @deprecated Accessorials are earnings (otherEarnings), not deductions.
     * Kept only for reading legacy settlements.
     */
    tonu?: number;
    layover?: number;
    detention?: number;
    other?: number;
  };
  
  paymentMethod?: string;
  checkNumber?: string;
  notes?: string;
  status?: 'draft' | 'pending' | 'processed' | 'paid' | 'void';
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
