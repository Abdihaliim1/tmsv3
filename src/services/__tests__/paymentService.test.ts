import { describe, expect, it } from 'vitest';
import {
  addPaymentToInvoice,
  allocatePaymentAcrossLoads,
  calculateTotalPaid,
  validatePayment,
} from '../paymentService';
import { Invoice } from '../../types';

const baseInvoice = (partial: Partial<Invoice> = {}): Invoice =>
  ({
    id: 'inv1',
    invoiceNumber: 'TEST-1',
    amount: 1000,
    status: 'pending',
    createdAt: '2026-01-01',
    ...partial,
  }) as Invoice;

describe('calculateTotalPaid', () => {
  it('does not double-count payments[] plus paidAmount', () => {
    const inv = baseInvoice({
      paidAmount: 400,
      payments: [
        { id: 'p1', invoiceId: 'inv1', amount: 400, date: '2026-01-02', method: 'ACH', createdAt: '2026-01-02' },
      ],
    });
    expect(calculateTotalPaid(inv)).toBe(400);
  });
});

describe('validatePayment', () => {
  it('rejects negative and overpayment', () => {
    const inv = baseInvoice({ paidAmount: 200 });
    expect(validatePayment(inv, -50).valid).toBe(false);
    expect(validatePayment(inv, 900).valid).toBe(false);
    expect(validatePayment(inv, 800).valid).toBe(true);
  });
});

describe('addPaymentToInvoice', () => {
  it('records second payment without double-counting', () => {
    let inv = baseInvoice();
    const first = addPaymentToInvoice(inv, { amount: 400, date: '2026-01-02', method: 'ACH' });
    inv = first.invoice;
    expect(calculateTotalPaid(inv)).toBe(400);
    expect(inv.status).toBe('partial');

    const second = addPaymentToInvoice(inv, { amount: 600, date: '2026-01-03', method: 'ACH' });
    expect(calculateTotalPaid(second.invoice)).toBe(1000);
    expect(second.invoice.status).toBe('paid');
  });
});

describe('allocatePaymentAcrossLoads', () => {
  it('splits payment by load revenue share', () => {
    const alloc = allocatePaymentAcrossLoads(1000, 1000, [
      { loadId: 'A', revenue: 600 },
      { loadId: 'B', revenue: 400 },
    ]);
    expect(alloc.find(a => a.loadId === 'A')?.paymentAmount).toBe(600);
    expect(alloc.find(a => a.loadId === 'B')?.paymentAmount).toBe(400);
  });

  it('never assigns full invoice payment to every load', () => {
    const alloc = allocatePaymentAcrossLoads(10000, 10000, [
      { loadId: 'A', revenue: 1000 },
      { loadId: 'B', revenue: 1000 },
    ]);
    expect(alloc.every(a => a.paymentAmount === 10000)).toBe(false);
    expect(alloc.every(a => a.paymentAmount === 5000)).toBe(true);
  });

  it('puts rounding remainder on the last load so allocations sum exactly', () => {
    const alloc = allocatePaymentAcrossLoads(1000, 100, [
      { loadId: 'A', revenue: 333 },
      { loadId: 'B', revenue: 333 },
      { loadId: 'C', revenue: 334 },
    ]);
    const sum = alloc.reduce((s, a) => s + a.paymentAmount, 0);
    expect(sum).toBe(100);
  });
});
