/**
 * Expense Types
 * 
 * Expense tracking and IFTA reporting types.
 */

// ============================================================================
// Expense Interface
// ============================================================================

export interface Expense {
  id: string;
  date: string;
  type: 'fuel' | 'maintenance' | 'insurance' | 'toll' | 'lumper' | 'permit' | 'lodging' | 'other';
  category?: string;
  description: string;
  driverId?: string;
  driverName?: string;
  truckId?: string;
  truckNumber?: string;
  loadId?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  receipt?: string;
  vendor?: string;
  paidBy?: 'company' | 'owner_operator' | 'tracked_only';
  expenseLedger?: {
    totalAmount: number;
    amountPaid: number;
    remainingBalance: number;
    status: 'active' | 'paid' | 'cancelled';
    createdAt: string;
    lastUpdated: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type NewExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// IFTA Types
// ============================================================================

export interface IFTAStateMiles {
  id: string;
  loadId: string;
  state: string;
  miles: number;
  date: string;
  truckId?: string;
  driverId?: string;
  createdAt?: string;
}

export interface IFTAFuelPurchase {
  id: string;
  date: string;
  state: string;
  gallons: number;
  cost: number;
  truckId?: string;
  driverId?: string;
  vendor?: string;
  receiptNumber?: string;
  odometerReading?: number;
  createdAt?: string;
}

export interface IFTAReport {
  id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  stateMiles: Record<string, number>;
  fuelPurchases: Record<string, { gallons: number; cost: number }>;
  mpg: number;
  taxDue: Record<string, number>;
  status: 'draft' | 'filed' | 'paid';
  filedDate?: string;
  createdAt: string;
  updatedAt: string;
}
