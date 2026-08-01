import { describe, expect, it } from 'vitest';
import {
  getISOWeekParts,
  weeksInISOYear,
  shiftISOWeekKey,
  formatISOWeekKey,
} from '../isoWeek';

describe('isoWeek', () => {
  it('supports week 53 years', () => {
    expect(weeksInISOYear(2020)).toBe(53);
    expect(weeksInISOYear(2026)).toBe(53);
  });

  it('shifts across week 53 correctly', () => {
    expect(shiftISOWeekKey('2026-W53', 1)).toBe('2027-W01');
    expect(shiftISOWeekKey('2027-W01', -1)).toBe('2026-W53');
  });

  it('formats ISO week keys', () => {
    const { week, year } = getISOWeekParts(new Date(2026, 11, 28)); // Dec 28 2026
    expect(formatISOWeekKey(year, week)).toMatch(/^\d{4}-W\d{2}$/);
  });
});
