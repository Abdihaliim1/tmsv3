/**
 * Factoring transaction ledger — separate from customer invoice payment status.
 */

export type FactoringFundingStatus =
  | 'submitted'
  | 'approved'
  | 'funded'
  | 'customer_paid'
  | 'rejected'
  | 'repurchased';

export interface FactoringTransaction {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  factoringCompanyId?: string;
  factoringCompanyName?: string;
  loadIds: string[];
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netFundedAmount: number;
  submittedDate?: string;
  fundedDate?: string;
  customerPaidDate?: string;
  fundingStatus: FactoringFundingStatus;
  recourseStatus?: 'none' | 'repurchase_pending' | 'repurchased' | 'charged_back';
  createdAt?: string;
  updatedAt?: string;
}

export type NewFactoringTransactionInput = Omit<FactoringTransaction, 'id' | 'createdAt' | 'updatedAt'>;
