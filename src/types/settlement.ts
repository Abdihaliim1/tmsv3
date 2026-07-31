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
  loads?: Array<{
    loadId: string;
    basePay?: number;
    detention?: number;
    layover?: number;
    tonu?: number;
  }>;
  
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
