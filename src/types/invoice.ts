/**
 * Invoice & Payment Types
 * 
 * Accounts receivable and payment tracking types.
 */

// ============================================================================
// Invoice Types
// ============================================================================

export type InvoiceStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'draft';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: 'ACH' | 'Check' | 'Wire' | 'Credit' | 'Factoring' | 'Other';
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  brokerId?: string;
  brokerName?: string;
  customerId?: string;
  customerName: string;
  loadId?: string;
  loadIds?: string[];
  amount: number;
  status: InvoiceStatus;
  date: string;
  dueDate?: string;
  paidAt?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  payments?: Payment[];
  isFactored?: boolean;
  factoringCompanyId?: string;
  factoringCompanyName?: string;
  factoredDate?: string;
  factoredAmount?: number;
  factoringFee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Broker & Factoring Types
// ============================================================================

export interface FactoringCompany {
  id: string;
  name: string;
  aliases?: string[];
  searchKey: string;
  prefixes: string[];
  feePercentage?: number;
  paymentTerms?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contactName?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewFactoringCompanyInput = Omit<FactoringCompany, 'id' | 'searchKey' | 'prefixes' | 'createdAt' | 'updatedAt'>;

export interface Broker {
  id: string;
  name: string;
  aliases?: string[];
  searchKey: string;
  prefixes: string[];
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewBrokerInput = Omit<Broker, 'id' | 'searchKey' | 'prefixes'>;

export type CustomerType = 'customer' | 'broker' | 'shipper' | 'consignee';
