/**
 * ISO week-year helpers (supports week 53).
 */

/** ISO week number + ISO week-year for a local date. */
export function getISOWeekParts(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year };
}

/** Number of ISO weeks in a year (52 or 53). */
export function weeksInISOYear(year: number): number {
  // A year has 53 ISO weeks if Jan 1 or Dec 31 is a Thursday
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));
  return jan1.getUTCDay() === 4 || dec31.getUTCDay() === 4 ? 53 : 52;
}

/** Monday (local) of the given ISO week. */
export function getDateOfISOWeek(week: number, year: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = new Date(simple);
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  isoWeekStart.setHours(0, 0, 0, 0);
  return isoWeekStart;
}

export function formatISOWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseISOWeekKey(key: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  return { year: parseInt(m[1], 10), week: parseInt(m[2], 10) };
}

/** Shift an ISO week key by delta weeks, respecting 52/53-week years. */
export function shiftISOWeekKey(key: string, delta: number): string {
  const parsed = parseISOWeekKey(key);
  if (!parsed) return key;
  let { year, week } = parsed;
  week += delta;
  while (week < 1) {
    year -= 1;
    week += weeksInISOYear(year);
  }
  while (week > weeksInISOYear(year)) {
    week -= weeksInISOYear(year);
    year += 1;
  }
  return formatISOWeekKey(year, week);
}

export function currentISOWeekKey(ref: Date = new Date()): string {
  const { week, year } = getISOWeekParts(ref);
  return formatISOWeekKey(year, week);
}
