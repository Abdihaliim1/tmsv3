/**
 * Invoice Generator Service
 *
 * Domain service for generating and managing invoices.
 * Handles invoice creation, line item calculations, and validation.
 */

import { Load, Invoice, InvoiceStatus, Payment, Broker, FactoringCompany } from '../types';
import { generateInvoiceNumber, generateInvoiceId, generatePaymentId } from '../utils/idGenerator';

// ============================================================================
// Types
// ============================================================================

export interface InvoiceLineItem {
  loadId: string;
  loadNumber: string;
  description: string;
  origin: string;
  destination: string;
  deliveryDate: string;
  baseRate: number;
  fuelSurcharge: number;
  detention: number;
  layover: number;
  lumper: number;
  otherAccessorials: number;
  lineTotal: number;
}

export interface InvoiceCalculation {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalFuelSurcharge: number;
  totalAccessorials: number;
  factoringFee: number;
  grandTotal: number;
  netAmount: number; // After factoring fee
}

export interface InvoiceInput {
  loads: Load[];
  broker?: Broker;
  customerId?: string;
  customerName: string;
  dueDate?: string;
  isFactored?: boolean;
  factoringCompany?: FactoringCompany;
  factoringFeePercent?: number;
  notes?: string;
}

export interface InvoiceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate invoice input before generation
 */
export function validateInvoiceInput(input: InvoiceInput): InvoiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate customer
  if (!input.customerName) {
    errors.push('Customer name is required');
  }

  // Validate loads
  if (!input.loads || input.loads.length === 0) {
    errors.push('At least one load is required for invoice');
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

    // Check for loads already invoiced
    const invoicedLoads = input.loads.filter(load => load.invoiceId);
    if (invoicedLoads.length > 0) {
      errors.push(
        `${invoicedLoads.length} load(s) already have invoices: ${invoicedLoads.map(l => l.loadNumber).join(', ')}`
      );
    }

    // Check for missing POD on delivered loads
    const loadsWithoutPOD = input.loads.filter(load => {
      const isDelivered = load.status === 'delivered' || load.status === 'completed';
      const hasPOD = load.documents?.some(doc =>
        doc.type === 'pod' || doc.type === 'POD'
      );
      return isDelivered && !hasPOD;
    });
    if (loadsWithoutPOD.length > 0) {
      warnings.push(
        `${loadsWithoutPOD.length} load(s) are missing POD: ${loadsWithoutPOD.map(l => l.loadNumber).join(', ')}`
      );
    }

    // Check for loads with zero rate
    const zeroRateLoads = input.loads.filter(load => !load.rate && !load.grandTotal);
    if (zeroRateLoads.length > 0) {
      errors.push(
        `${zeroRateLoads.length} load(s) have no rate: ${zeroRateLoads.map(l => l.loadNumber).join(', ')}`
      );
    }
  }

  // Validate factoring
  if (input.isFactored) {
    if (!input.factoringCompany && !input.factoringFeePercent) {
      warnings.push('Factoring enabled but no factoring company or fee specified');
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
 * Calculate line item for a load
 */
function calculateLineItem(load: Load): InvoiceLineItem {
  const baseRate = load.rate || 0;
  const fuelSurcharge = load.fscAmount || 0;
  const detention = load.detentionAmount || 0;
  const layover = load.layoverAmount || 0;
  const lumper = load.lumperFee || load.lumperAmount || 0;
  const otherAccessorials = load.otherAccessorials || 0;

  const lineTotal = baseRate + fuelSurcharge + detention + layover + lumper + otherAccessorials;

  return {
    loadId: load.id,
    loadNumber: load.loadNumber,
    description: `${load.originCity}, ${load.originState} to ${load.destCity}, ${load.destState}`,
    origin: `${load.originCity}, ${load.originState}`,
    destination: `${load.destCity}, ${load.destState}`,
    deliveryDate: load.deliveryDate,
    baseRate,
    fuelSurcharge,
    detention,
    layover,
    lumper,
    otherAccessorials,
    lineTotal
  };
}

/**
 * Calculate full invoice
 */
export function calculateInvoice(input: InvoiceInput): InvoiceCalculation {
  // Calculate line items
  const lineItems = input.loads.map(load => calculateLineItem(load));

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.baseRate, 0);
  const totalFuelSurcharge = lineItems.reduce((sum, item) => sum + item.fuelSurcharge, 0);
  const totalAccessorials = lineItems.reduce(
    (sum, item) => sum + item.detention + item.layover + item.lumper + item.otherAccessorials,
    0
  );

  const grandTotal = subtotal + totalFuelSurcharge + totalAccessorials;

  // Calculate factoring fee
  let factoringFee = 0;
  if (input.isFactored) {
    const feePercent = input.factoringFeePercent ||
      input.factoringCompany?.feePercentage ||
      0;
    factoringFee = grandTotal * (feePercent / 100);
  }

  const netAmount = grandTotal - factoringFee;

  return {
    lineItems,
    subtotal,
    totalFuelSurcharge,
    totalAccessorials,
    factoringFee,
    grandTotal,
    netAmount
  };
}

/**
 * Create an invoice object ready for saving
 */
export function createInvoice(
  input: InvoiceInput,
  calculation: InvoiceCalculation,
  options?: { invoiceNumber?: string; status?: InvoiceStatus }
): Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> {
  const invoiceNumber = options?.invoiceNumber || generateInvoiceNumber();
  const today = new Date().toISOString().split('T')[0];

  // Calculate due date (default: Net 30)
  const dueDate = input.dueDate || (() => {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    return due.toISOString().split('T')[0];
  })();

  return {
    invoiceNumber,
    brokerId: input.broker?.id,
    brokerName: input.broker?.name,
    customerId: input.customerId || input.broker?.id,
    customerName: input.customerName,
    loadId: input.loads.length === 1 ? input.loads[0].id : undefined,
    loadIds: input.loads.map(l => l.id),
    amount: calculation.grandTotal,
    status: options?.status || 'pending',
    date: today,
    dueDate,
    paidAmount: 0,
    payments: [],
    isFactored: input.isFactored,
    factoringCompanyId: input.factoringCompany?.id,
    factoringCompanyName: input.factoringCompany?.name,
    factoringFee: calculation.factoringFee,
    factoredAmount: input.isFactored ? calculation.netAmount : undefined,
    notes: input.notes
  };
}

// ============================================================================
// Payment Functions
// ============================================================================

export interface PaymentValidationResult {
  valid: boolean;
  error?: string;
  maxAmount?: number;
}

/**
 * Validate payment against invoice
 */
export function validatePayment(invoice: Invoice, paymentAmount: number): PaymentValidationResult {
  if (paymentAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than 0' };
  }

  const totalPaid = calculateTotalPaid(invoice);
  const outstanding = invoice.amount - totalPaid;

  // Allow 1% tolerance for rounding
  if (paymentAmount > outstanding * 1.01) {
    return {
      valid: false,
      error: `Payment exceeds outstanding balance. Maximum: $${outstanding.toFixed(2)}`,
      maxAmount: outstanding
    };
  }

  return { valid: true };
}

/**
 * Calculate total paid from payment history
 */
export function calculateTotalPaid(invoice: Invoice): number {
  if (invoice.payments && invoice.payments.length > 0) {
    return invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  }
  return invoice.paidAmount || 0;
}

/**
 * Calculate outstanding balance
 */
export function calculateOutstandingBalance(invoice: Invoice): number {
  return Math.max(0, invoice.amount - calculateTotalPaid(invoice));
}

/**
 * Determine invoice status based on payments
 */
export function calculateInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const totalPaid = calculateTotalPaid(invoice);
  const total = invoice.amount;

  // Fully paid (99% threshold for rounding)
  if (totalPaid >= total * 0.99) {
    return 'paid';
  }

  // Partially paid - check if overdue
  if (totalPaid > 0) {
    if (isOverdue(invoice)) {
      return 'overdue';
    }
    return 'partial';
  }

  // Not paid - check if overdue
  if (isOverdue(invoice)) {
    return 'overdue';
  }

  return 'pending';
}

/**
 * Check if invoice is overdue
 */
function isOverdue(invoice: Invoice): boolean {
  if (!invoice.dueDate) return false;

  const due = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

/**
 * Add payment to invoice
 */
export function addPaymentToInvoice(
  invoice: Invoice,
  payment: Omit<Payment, 'id' | 'invoiceId' | 'createdAt'>
): { invoice: Invoice; payment: Payment } {
  // Validate payment
  const validation = validatePayment(invoice, payment.amount);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid payment');
  }

  // Create payment record
  const paymentRecord: Payment = {
    ...payment,
    id: generatePaymentId(),
    invoiceId: invoice.id,
    createdAt: new Date().toISOString()
  };

  // Update invoice
  const payments = [...(invoice.payments || []), paymentRecord];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const newStatus = calculateInvoiceStatus({ ...invoice, payments });

  const updatedInvoice: Invoice = {
    ...invoice,
    payments,
    paidAmount: totalPaid,
    status: newStatus,
    paidAt: newStatus === 'paid' ? payment.date : invoice.paidAt,
    updatedAt: new Date().toISOString()
  };

  return { invoice: updatedInvoice, payment: paymentRecord };
}

// ============================================================================
// AR Aging Functions
// ============================================================================

export interface AgingBucket {
  current: number;     // 0-30 days
  days31_60: number;   // 31-60 days
  days61_90: number;   // 61-90 days
  days90Plus: number;  // 90+ days
  total: number;
}

/**
 * Calculate aging bucket for a single invoice
 */
export function calculateAging(invoice: Invoice, asOfDate: Date = new Date()): AgingBucket {
  const outstanding = calculateOutstandingBalance(invoice);

  if (outstanding <= 0 || !invoice.dueDate) {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
  }

  const dueDate = new Date(invoice.dueDate);
  const daysPastDue = Math.floor(
    (asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysPastDue <= 0) {
    return { current: outstanding, days31_60: 0, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 30) {
    return { current: outstanding, days31_60: 0, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 60) {
    return { current: 0, days31_60: outstanding, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 90) {
    return { current: 0, days31_60: 0, days61_90: outstanding, days90Plus: 0, total: outstanding };
  } else {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: outstanding, total: outstanding };
  }
}

/**
 * Calculate AR aging summary for multiple invoices
 */
export function calculateARAgingSummary(invoices: Invoice[], asOfDate: Date = new Date()): AgingBucket {
  const summary: AgingBucket = {
    current: 0,
    days31_60: 0,
    days61_90: 0,
    days90Plus: 0,
    total: 0
  };

  invoices.forEach(invoice => {
    const aging = calculateAging(invoice, asOfDate);
    summary.current += aging.current;
    summary.days31_60 += aging.days31_60;
    summary.days61_90 += aging.days61_90;
    summary.days90Plus += aging.days90Plus;
    summary.total += aging.total;
  });

  return summary;
}

/**
 * Get days outstanding for invoice
 */
export function getDaysOutstanding(invoice: Invoice, asOfDate: Date = new Date()): number {
  if (!invoice.dueDate) return 0;

  const due = new Date(invoice.dueDate);
  const days = Math.floor((asOfDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get loads eligible for invoicing (delivered, not yet invoiced)
 */
export function getEligibleLoadsForInvoice(
  loads: Load[],
  customerId?: string,
  brokerId?: string
): Load[] {
  return loads.filter(load => {
    // Must be delivered or completed
    if (load.status !== 'delivered' && load.status !== 'completed') return false;

    // Must not already be invoiced
    if (load.invoiceId) return false;

    // Optional: filter by customer/broker
    if (customerId && load.brokerId !== customerId && load.customerName !== customerId) {
      return false;
    }
    if (brokerId && load.brokerId !== brokerId) {
      return false;
    }

    return true;
  });
}

/**
 * Group loads by broker for batch invoicing
 */
export function groupLoadsByBroker(loads: Load[]): Map<string, Load[]> {
  const grouped = new Map<string, Load[]>();

  loads.forEach(load => {
    const brokerId = load.brokerId || load.brokerName || 'unknown';
    const existing = grouped.get(brokerId) || [];
    grouped.set(brokerId, [...existing, load]);
  });

  return grouped;
}

/**
 * Format invoice amount for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Get invoice summary statistics
 */
export function getInvoiceSummary(invoices: Invoice[]): {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  count: number;
  paidCount: number;
  overdueCount: number;
} {
  let totalInvoiced = 0;
  let totalPaid = 0;
  let paidCount = 0;
  let overdueCount = 0;

  invoices.forEach(invoice => {
    totalInvoiced += invoice.amount;
    totalPaid += calculateTotalPaid(invoice);

    if (invoice.status === 'paid') paidCount++;
    if (invoice.status === 'overdue') overdueCount++;
  });

  return {
    totalInvoiced,
    totalPaid,
    totalOutstanding: totalInvoiced - totalPaid,
    count: invoices.length,
    paidCount,
    overdueCount
  };
}
