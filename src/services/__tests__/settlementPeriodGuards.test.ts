import { describe, it, expect } from 'vitest';
import { parseDateOnlyLocal, formatLocalDate } from '../../utils/dateOnly';

/** Mirrors Settlements.tsx helpers for regression coverage. */
function getLoadSettlementDate(load: {
  deliveryDate?: string;
  pickupDate?: string;
}): Date | null {
  const raw = load.deliveryDate || load.pickupDate || '';
  if (!raw) return null;
  const d = parseDateOnlyLocal(String(raw).split('T')[0]);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatSettlementLoadBadges<T>(items: T[], max = 3) {
  const visible = items.slice(0, max);
  return { visible, remaining: Math.max(0, items.length - visible.length) };
}

describe('settlement period / badge guards', () => {
  it('truncates badges to first 3 + remaining count', () => {
    const loads = Array.from({ length: 116 }, (_, i) => ({ id: String(i) }));
    const { visible, remaining } = formatSettlementLoadBadges(loads);
    expect(visible).toHaveLength(3);
    expect(remaining).toBe(113);
  });

  it('treats Feb–Jul loads as outside a Jul 27–Aug 2 week', () => {
    const weekStart = parseDateOnlyLocal('2026-07-27');
    const weekEnd = parseDateOnlyLocal('2026-08-02');
    const loadDates = ['2026-02-09', '2026-07-22', '2026-07-28'].map(d =>
      getLoadSettlementDate({ deliveryDate: d })
    );
    const outside = loadDates.filter(d => !d || d < weekStart || d > weekEnd);
    expect(outside).toHaveLength(2);
    expect(formatLocalDate(loadDates[2]!)).toBe('2026-07-28');
  });

  it('derives custom period from min/max selected load dates', () => {
    const dates = ['2026-02-09', '2026-07-22', '2026-04-01']
      .map(d => getLoadSettlementDate({ deliveryDate: d })!)
      .sort((a, b) => a.getTime() - b.getTime());
    expect(formatLocalDate(dates[0])).toBe('2026-02-09');
    expect(formatLocalDate(dates[dates.length - 1])).toBe('2026-07-22');
  });
});
