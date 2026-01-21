/**
 * Payment Service - Invoice Payment Management
 * 
 * Handles:
 * - Payment validation (overpayment blocking)
 * - Payment history tracking
 * - Invoice status auto-updates
 * - AR aging calculations
 */

import { Invoice, Payment, InvoiceStatus } from '../types';
import { generatePaymentId } from '../utils/idGenerator';

/**
 * Validate payment amount against invoice
 * Returns validation result with error message if invalid
 */
export function validatePayment(
  invoice: Invoice,
  paymentAmount: number
): { valid: boolean; error?: string; maxAmount?: number } {
  if (paymentAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than 0' };
  }

  const currentPaid = calculateTotalPaid(invoice);
  const total = invoice.amount;
  const newTotal = currentPaid + paymentAmount;

  // Allow 1% tolerance for rounding differences
  if (newTotal > total * 1.01) {
    const maxAmount = total - currentPaid;
    return {
      valid: false,
      error: `Payment would exceed invoice amount. Maximum payment: $${maxAmount.toFixed(2)}. Invoice total: $${total.toFixed(2)}, Already paid: $${currentPaid.toFixed(2)}`,
      maxAmount: maxAmount
    };
  }

  return { valid: true };
}

/**
 * Calculate total paid from payment history
 */
export function calculateTotalPaid(invoice: Invoice): number {
  if (invoice.payments && invoice.payments.length > 0) {
    return invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }
  // Fallback to legacy paidAmount field
  return invoice.paidAmount || 0;
}

/**
 * Calculate outstanding balance
 */
export function calculateOutstandingBalance(invoice: Invoice): number {
  const totalPaid = calculateTotalPaid(invoice);
  return Math.max(0, invoice.amount - totalPaid);
}

/**
 * Auto-update invoice status based on payments
 */
export function calculateInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const totalPaid = calculateTotalPaid(invoice);
  const total = invoice.amount;
  const outstanding = total - totalPaid;

  // Check if fully paid (99% threshold to account for rounding)
  if (totalPaid >= total * 0.99) {
    return 'paid';
  }

  // Check if partially paid
  if (totalPaid > 0) {
    // Check if overdue
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        return 'overdue';
      }
    }
    return 'partial';
  }

  // Not paid - check if overdue
  if (invoice.dueDate) {
    const due = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      return 'overdue';
    }
  }

  return 'pending';
}

/**
 * Add payment to invoice
 * Returns updated invoice data
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

  // Add to payments array
  const payments = [...(invoice.payments || []), paymentRecord];

  // Calculate new totals
  const totalPaid = calculateTotalPaid({ ...invoice, payments });
  const newStatus = calculateInvoiceStatus({ ...invoice, payments });

  // Update invoice
  const updatedInvoice: Invoice = {
    ...invoice,
    payments,
    paidAmount: totalPaid, // Keep legacy field in sync
    status: newStatus,
    paidAt: newStatus === 'paid' ? payment.date : invoice.paidAt,
    updatedAt: new Date().toISOString()
  };

  return { invoice: updatedInvoice, payment: paymentRecord };
}

/**
 * AR Aging Buckets
 */
export interface AgingBucket {
  current: number;    // 0-30 days
  days31_60: number;  // 31-60 days
  days61_90: number;  // 61-90 days
  days90Plus: number; // 90+ days
  total: number;
}

/**
 * Calculate AR aging for an invoice
 */
export function calculateAging(
  invoice: Invoice,
  asOfDate: Date = new Date()
): AgingBucket {
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (!dueDate) {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
  }

  const outstanding = calculateOutstandingBalance(invoice);
  if (outstanding <= 0) {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
  }

  // Calculate days past due (or days until due for current bucket)
  const daysPastDue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysPastDue <= 0) {
    // Current (not yet due)
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
 * Calculate AR aging summary for all invoices
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


