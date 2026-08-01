/**
 * Per-load factoring funding — independent of customer invoice.status.
 */

import { Load, Invoice, LoadFactoringStatus, InvoiceStatus } from '../types';
import { getLoadRevenue } from './businessLogic';

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getLoadFactoredAmount(load: Load): number {
  const stored = Number(load.factoredAmount) || 0;
  if (stored > 0) return roundMoney(stored);
  return roundMoney(getLoadRevenue(load));
}

export function getLoadFeePercent(
  load: Load,
  invoice?: Invoice | null,
  companyFeePercent?: number
): number {
  let pct =
    Number(load.factoringFeePercent) ||
    Number(invoice?.factoringFeePercent) ||
    Number(companyFeePercent) ||
    0;
  if (pct <= 0) pct = 2.5;
  if (pct > 100) pct = 100;
  return pct;
}

function invoiceLoadIdSet(invoice: Invoice): string[] {
  const ids = new Set<string>();
  if (invoice.loadId) ids.add(invoice.loadId);
  (invoice.loadIds || []).forEach(id => ids.add(id));
  return Array.from(ids);
}

/**
 * Canonical per-load fee.
 * Prefer invoice fee × revenue share (keeps sum = invoice fee after cents).
 * Never use a stored load.factoringFee that equals the full invoice fee.
 */
export function getLoadAllocatedFee(
  load: Load,
  invoice?: Invoice | null,
  companyFeePercent?: number
): number {
  const amount = getLoadFactoredAmount(load);
  if (amount <= 0) return 0;
  const pct = getLoadFeePercent(load, invoice, companyFeePercent);
  const computed = roundMoney(amount * (pct / 100));

  if (invoice) {
    const invIds = invoiceLoadIdSet(invoice);
    const invoiceAmount = Number(invoice.amount) || 0;
    let invoiceFee = Number(invoice.factoringFee) || 0;
    if (invoiceFee <= 0 && invoiceAmount > 0) {
      invoiceFee = roundMoney(invoiceAmount * (pct / 100));
    }
    if (invoiceFee > 0 && invoiceAmount > 0 && invIds.length >= 1) {
      return roundMoney(invoiceFee * (amount / invoiceAmount));
    }
  }

  return computed;
}

export function getLoadExpectedNet(
  load: Load,
  invoice?: Invoice | null,
  companyFeePercent?: number
): number {
  return roundMoney(
    getLoadFactoredAmount(load) - getLoadAllocatedFee(load, invoice, companyFeePercent)
  );
}

export function isLoadFunded(load: Load): boolean {
  if (load.factoringStatus === 'funded') return true;
  if (load.paymentReceived === true) return true;
  return false;
}

export function isLoadHeld(load: Load): boolean {
  return load.factoringStatus === 'held' || load.factoringStatus === 'rejected';
}

/** Resolve display/status for a factored load (never from invoice.status alone). */
export function getLoadFactoringStatus(load: Load): LoadFactoringStatus {
  if (load.factoringStatus) return load.factoringStatus;
  if (load.paymentReceived) return 'funded';
  if (load.isFactored || load.factoredDate || load.factoringCompanyId) return 'submitted';
  return 'not_submitted';
}

export function getLoadActualReceived(load: Load): number {
  if (!isLoadFunded(load)) return 0;
  const amount = Number(load.actualReceived ?? load.paymentAmount) || 0;
  if (amount > 0) return roundMoney(amount);
  return getLoadExpectedNet(load);
}

export type FactoredLoadsSummary = {
  totalFactoredAmount: number;
  expectedFees: number;
  expectedNet: number;
  actualNetReceived: number;
  fundedLoads: number;
  pendingLoads: number;
  heldLoads: number;
  totalLoads: number;
};

export function summarizeFactoredLoads(
  items: Array<{ load: Load; invoice?: Invoice | null; feePercent?: number }>
): FactoredLoadsSummary {
  let totalFactoredAmount = 0;
  let expectedFees = 0;
  let actualNetReceived = 0;
  let fundedLoads = 0;
  let pendingLoads = 0;
  let heldLoads = 0;

  // Group by invoice so expected fees = invoice fee (not sum of rounded per-load pennies)
  const byInvoice = new Map<string, { invoice: Invoice; items: typeof items }>();
  const orphans: typeof items = [];

  items.forEach(item => {
    totalFactoredAmount += getLoadFactoredAmount(item.load);
    if (isLoadHeld(item.load)) heldLoads += 1;
    else if (isLoadFunded(item.load)) {
      fundedLoads += 1;
      actualNetReceived += getLoadActualReceived(item.load);
    } else pendingLoads += 1;

    if (item.invoice?.id) {
      const bucket = byInvoice.get(item.invoice.id) || { invoice: item.invoice, items: [] };
      bucket.items.push(item);
      byInvoice.set(item.invoice.id, bucket);
    } else {
      orphans.push(item);
    }
  });

  byInvoice.forEach(({ invoice, items: invItems }) => {
    const pct = getLoadFeePercent(invItems[0].load, invoice, invItems[0].feePercent);
    const invAmount =
      Number(invoice.amount) ||
      invItems.reduce((s, i) => s + getLoadFactoredAmount(i.load), 0);
    let invoiceFee = Number(invoice.factoringFee) || 0;
    if (invoiceFee <= 0) {
      invoiceFee = roundMoney(invAmount * (pct / 100));
    }
    // If only a subset of invoice loads is in this report, allocate by revenue share
    const periodAmount = invItems.reduce((s, i) => s + getLoadFactoredAmount(i.load), 0);
    if (invAmount > 0 && periodAmount < invAmount - 0.01) {
      expectedFees += roundMoney(invoiceFee * (periodAmount / invAmount));
    } else {
      expectedFees += roundMoney(invoiceFee);
    }
  });

  orphans.forEach(({ load, invoice, feePercent }) => {
    expectedFees += getLoadAllocatedFee(load, invoice, feePercent);
  });

  totalFactoredAmount = roundMoney(totalFactoredAmount);
  expectedFees = roundMoney(expectedFees);
  const expectedNet = roundMoney(totalFactoredAmount - expectedFees);

  return {
    totalFactoredAmount,
    expectedFees,
    expectedNet,
    actualNetReceived: roundMoney(actualNetReceived),
    fundedLoads,
    pendingLoads,
    heldLoads,
    totalLoads: items.length,
  };
}

export function buildMarkLoadFundedPatch(
  load: Load,
  invoice?: Invoice | null,
  companyFeePercent?: number,
  paymentReference?: string
): Partial<Load> {
  const factoredAmount = getLoadFactoredAmount(load);
  const feePercentage = getLoadFeePercent(load, invoice, companyFeePercent);
  const allocatedFee = getLoadAllocatedFee(load, invoice, companyFeePercent);
  const expectedNet = roundMoney(factoredAmount - allocatedFee);
  const now = new Date().toISOString();

  return {
    isFactored: true,
    factoringStatus: 'funded',
    factoredAmount,
    factoringFeePercent: feePercentage,
    factoringFee: allocatedFee,
    expectedNet,
    actualReceived: expectedNet,
    paymentReceived: true,
    paymentAmount: expectedNet,
    paymentReceivedDate: now.split('T')[0],
    fundedAt: now,
    factoringPaymentReference: paymentReference || 'Factoring',
    factoringCompanyId: load.factoringCompanyId || invoice?.factoringCompanyId,
    factoringCompanyName: load.factoringCompanyName || invoice?.factoringCompanyName,
    factoringInvoiceId: invoice?.id || load.factoringInvoiceId || load.invoiceId,
  };
}

export function buildMarkLoadHeldPatch(_reason?: string): Partial<Load> {
  return {
    factoringStatus: 'held',
    paymentReceived: false,
    paymentAmount: 0,
    actualReceived: 0,
  };
}

export type DerivedInvoiceFunding = {
  status: InvoiceStatus;
  fundingStatus: NonNullable<Invoice['fundingStatus']>;
  paidAmount: number;
  factorFundedDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
};

/**
 * Derive invoice AR + funding status from sibling loads' per-load funding.
 * Never marks Paid unless every included load is funded (and none held/rejected).
 */
export function deriveInvoiceFundingFromLoads(
  invoice: Invoice,
  loads: Load[]
): DerivedInvoiceFunding {
  const ids = new Set<string>();
  if (invoice.loadId) ids.add(invoice.loadId);
  (invoice.loadIds || []).forEach(id => ids.add(id));

  const siblings = loads.filter(l => ids.has(l.id));
  if (siblings.length === 0) {
    return {
      status: invoice.status === 'paid' ? 'pending' : invoice.status,
      fundingStatus: invoice.fundingStatus || 'submitted',
      paidAmount: 0,
    };
  }

  const funded = siblings.filter(isLoadFunded);
  const held = siblings.filter(isLoadHeld);
  const actual = roundMoney(funded.reduce((s, l) => s + getLoadActualReceived(l), 0));

  if (held.length > 0 && funded.length > 0) {
    return {
      status: 'partial',
      fundingStatus: 'approved',
      paidAmount: actual,
    };
  }
  if (held.length > 0 && funded.length === 0) {
    return {
      status: 'pending',
      fundingStatus: 'submitted',
      paidAmount: 0,
    };
  }
  if (funded.length === 0) {
    return {
      status: 'pending',
      fundingStatus: 'submitted',
      paidAmount: 0,
    };
  }
  if (funded.length < siblings.length) {
    return {
      status: 'partial',
      fundingStatus: 'approved',
      paidAmount: actual,
    };
  }

  // All funded
  const fundedAt =
    funded
      .map(l => l.fundedAt || l.paymentReceivedDate)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || new Date().toISOString();

  return {
    status: 'paid',
    fundingStatus: 'funded',
    paidAmount: actual,
    factorFundedDate: fundedAt.split('T')[0],
    paidAt: fundedAt,
    paymentMethod: 'Factoring',
    paymentReference: 'Factored',
  };
}
