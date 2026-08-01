/**
 * Settlement period helpers — derive periods from load dates and allocate
 * settlement dollars into report windows without repeating full net pay.
 */

import type { Load, Settlement } from '../types';
import { formatLocalDate, parseDateOnlyLocal } from '../utils/dateOnly';

export type SettlementPeriodBounds = {
  start: string; // YYYY-MM-DD
  end: string;
  display: string;
};

export type PeriodAllocation = {
  inPeriod: boolean;
  loadCountInPeriod: number;
  loadCountTotal: number;
  /** 0–1 share of settlement attributed to the report window */
  share: number;
  grossShare: number;
  netShare: number;
  deductionsShare: number;
};

const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function getLoadSettlementDate(load: {
  deliveryDate?: string;
  pickupDate?: string;
}): Date | null {
  const raw = load.deliveryDate || load.pickupDate || '';
  if (!raw) return null;
  const d = parseDateOnlyLocal(String(raw).split('T')[0]);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Collect settlement load refs with dates + pay weight for allocation. */
export function collectSettlementLoadWeights(
  settlement: Settlement,
  liveLoads: Load[]
): Array<{ loadId: string; date: Date | null; weight: number }> {
  const byId = new Map(liveLoads.map(l => [l.id, l]));
  const ids = new Set<string>();
  if (settlement.loadId) ids.add(settlement.loadId);
  (settlement.loadIds || []).forEach(id => ids.add(id));
  (settlement.loads || []).forEach(sl => {
    if (sl.loadId) ids.add(sl.loadId);
  });

  const rows: Array<{ loadId: string; date: Date | null; weight: number }> = [];
  ids.forEach(loadId => {
    const embedded = (settlement.loads || []).find(sl => sl.loadId === loadId);
    const live = byId.get(loadId);
    // Prefer snapshot dates, fall back to live load dates
    const date =
      getLoadSettlementDate(embedded || {}) || getLoadSettlementDate(live || {});
    const linePay =
      (embedded?.basePay || 0) +
      (embedded?.detention || 0) +
      (embedded?.layover || 0) +
      (embedded?.tonu || 0) +
      (embedded?.dispatchFee || 0);
    const companyGross = embedded?.companyGross ?? (live?.grandTotal || live?.rate || 0);
    const weight = linePay > 0 ? linePay : companyGross > 0 ? companyGross : 1;
    rows.push({ loadId, date, weight });
  });
  return rows;
}

/**
 * Derive the true pay period from linked load delivery/pickup dates.
 * Used to migrate bad settlements (e.g. ST-2026-1003 week vs Feb–Jul loads).
 */
export function deriveSettlementPeriodFromLoads(
  settlement: Settlement,
  liveLoads: Load[]
): SettlementPeriodBounds | null {
  const dates = collectSettlementLoadWeights(settlement, liveLoads)
    .map(r => r.date)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length === 0) return null;
  const start = dates[0];
  const end = dates[dates.length - 1];
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
    display: formatDateRange(start, end),
  };
}

/** True when any linked load date falls outside the stored settlement period. */
export function settlementHasPeriodMismatch(
  settlement: Settlement,
  liveLoads: Load[]
): boolean {
  const startRaw =
    settlement.periodStart ||
    (typeof settlement.period === 'object' ? settlement.period?.start : undefined);
  const endRaw =
    settlement.periodEnd ||
    (typeof settlement.period === 'object' ? settlement.period?.end : undefined);
  if (!startRaw || !endRaw) return false;
  const start = parseDateOnlyLocal(String(startRaw).split('T')[0]);
  const end = parseDateOnlyLocal(String(endRaw).split('T')[0]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const weights = collectSettlementLoadWeights(settlement, liveLoads);
  if (weights.length === 0) return false;
  return weights.some(r => !r.date || r.date < start || r.date > end);
}

/**
 * Allocate settlement dollars into a report window by load dates.
 * Prevents multi-month settlements from repeating full netPay in every overlapping month.
 */
export function allocateSettlementToPeriod(
  settlement: Settlement,
  liveLoads: Load[],
  periodStart: Date,
  periodEnd: Date
): PeriodAllocation {
  const rows = collectSettlementLoadWeights(settlement, liveLoads);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const inPeriodRows = rows.filter(
    r => r.date && r.date >= periodStart && r.date <= periodEnd
  );
  const inWeight = inPeriodRows.reduce((s, r) => s + r.weight, 0);
  const share =
    totalWeight > 0 && inWeight > 0
      ? inWeight / totalWeight
      : inPeriodRows.length > 0 && rows.length > 0
        ? inPeriodRows.length / rows.length
        : 0;

  const gross = Number(settlement.grossPay) || 0;
  const net = Number(settlement.netPay) || 0;
  const deductions = Number(settlement.totalDeductions) || 0;

  return {
    inPeriod: share > 0,
    loadCountInPeriod: inPeriodRows.length,
    loadCountTotal: rows.length,
    share,
    grossShare: roundMoney(gross * share),
    netShare: roundMoney(net * share),
    deductionsShare: roundMoney(deductions * share),
  };
}

/** Patch fields to persist a derived period onto a settlement. */
export function buildPeriodRepairPatch(
  bounds: SettlementPeriodBounds
): Pick<Settlement, 'periodStart' | 'periodEnd' | 'period'> {
  return {
    periodStart: bounds.start,
    periodEnd: bounds.end,
    period: {
      start: bounds.start,
      end: bounds.end,
      display: bounds.display,
    },
  };
}
