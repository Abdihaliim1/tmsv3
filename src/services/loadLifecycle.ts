/**
 * Load lifecycle — legal status transitions and helpers.
 */

import { LoadStatus } from '../types';

const ALLOWED_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  [LoadStatus.Available]: [LoadStatus.Dispatched, LoadStatus.Cancelled, LoadStatus.TONU],
  [LoadStatus.Dispatched]: [
    LoadStatus.InTransit,
    LoadStatus.Delivered,
    LoadStatus.Cancelled,
    LoadStatus.TONU,
  ],
  [LoadStatus.InTransit]: [LoadStatus.Delivered, LoadStatus.Cancelled, LoadStatus.TONU],
  [LoadStatus.Delivered]: [
    LoadStatus.DeliveredWithBOL,
    LoadStatus.Invoiced,
    LoadStatus.Completed,
    LoadStatus.Cancelled,
  ],
  [LoadStatus.DeliveredWithBOL]: [LoadStatus.Invoiced, LoadStatus.Completed],
  [LoadStatus.Invoiced]: [LoadStatus.Paid],
  [LoadStatus.Paid]: [],
  [LoadStatus.Completed]: [LoadStatus.Invoiced, LoadStatus.Paid],
  [LoadStatus.Cancelled]: [],
  [LoadStatus.TONU]: [LoadStatus.Invoiced, LoadStatus.Cancelled],
};

/** Terminal / financial statuses that must not be jumped into from early lifecycle. */
const FINANCIAL_OR_TERMINAL: LoadStatus[] = [
  LoadStatus.Delivered,
  LoadStatus.DeliveredWithBOL,
  LoadStatus.Invoiced,
  LoadStatus.Paid,
  LoadStatus.Completed,
  LoadStatus.Cancelled,
  LoadStatus.TONU,
];

/** Current status plus legally allowed next statuses (for status dropdowns). */
export function getAllowedLoadStatusOptions(from: LoadStatus | string): LoadStatus[] {
  const fromStatus = from as LoadStatus;
  const next = ALLOWED_TRANSITIONS[fromStatus] || [];
  const options = [fromStatus, ...next];
  return Array.from(new Set(options));
}

export function canTransitionLoadStatus(
  from: LoadStatus | string,
  to: LoadStatus | string
): { ok: boolean; reason?: string } {
  if (from === to) return { ok: true };

  const fromStatus = from as LoadStatus;
  const toStatus = to as LoadStatus;
  const allowed = ALLOWED_TRANSITIONS[fromStatus];

  if (!allowed) {
    return { ok: false, reason: `Unknown current status: ${from}` };
  }

  if (!allowed.includes(toStatus)) {
    // Explicitly block skipping ahead to delivered/paid/completed/cancelled from available
    if (
      fromStatus === LoadStatus.Available &&
      FINANCIAL_OR_TERMINAL.includes(toStatus) &&
      toStatus !== LoadStatus.Cancelled &&
      toStatus !== LoadStatus.TONU
    ) {
      return {
        ok: false,
        reason: `Cannot move load from Available directly to ${to}. Dispatch the load first.`,
      };
    }
    return {
      ok: false,
      reason: `Illegal status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none'}.`,
    };
  }

  return { ok: true };
}

export function isInvoiceLinked(
  loadId: string,
  invoiceId: string | undefined,
  invoices: Array<{ id: string; loadId?: string; loadIds?: string[] }>
): boolean {
  if (invoiceId && invoiceId !== 'pending') return true;
  return invoices.some(
    inv => inv.loadId === loadId || (Array.isArray(inv.loadIds) && inv.loadIds.includes(loadId))
  );
}
