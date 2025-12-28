/**
 * Date-Only Utilities
 * 
 * IMPORTANT: These utilities treat date strings as LOCAL dates, not UTC.
 * This prevents the off-by-one date bug caused by timezone shifts.
 * 
 * Example bug: "2025-12-01" parsed with new Date() becomes UTC midnight,
 * which in US timezones (-05) becomes "2025-11-30 7:00 PM" local time.
 * 
 * ALWAYS use these utilities for:
 * - Insurance expiration dates
 * - Expense dates
 * - Any date used for monthly grouping/filtering
 */

/**
 * Parse a date-only string (YYYY-MM-DD) as LOCAL time
 * Returns a Date object set to midnight LOCAL time
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns Date object at local midnight
 */
export function parseDateOnlyLocal(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date(); // Fallback to now
  }
  
  // Handle ISO format with time component
  const cleanDate = dateStr.split('T')[0];
  
  const [y, m, d] = cleanDate.split('-').map(Number);
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    console.warn('Invalid date string:', dateStr);
    return new Date();
  }
  
  // Create date at local midnight (NOT UTC)
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get month key from a date-only string
 * Returns "YYYY-MM" format based on LOCAL time
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns Month key like "2025-12"
 */
export function monthKeyFromDateOnly(dateStr: string): string {
  const dt = parseDateOnlyLocal(dateStr);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get month key from a Firestore Timestamp or Date object
 * Uses LOCAL time for consistency
 * 
 * @param ts - Firestore Timestamp, Date, or date string
 * @returns Month key like "2025-12"
 */
export function monthKeyFromTimestamp(ts: any): string {
  if (!ts) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  // Handle Firestore Timestamp
  const dt = ts?.toDate ? ts.toDate() : (typeof ts === 'string' ? parseDateOnlyLocal(ts) : new Date(ts));
  
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get year from a date-only string using LOCAL time
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns Year number
 */
export function yearFromDateOnly(dateStr: string): number {
  return parseDateOnlyLocal(dateStr).getFullYear();
}

/**
 * Get month (1-12) from a date-only string using LOCAL time
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns Month number (1-12)
 */
export function monthFromDateOnly(dateStr: string): number {
  return parseDateOnlyLocal(dateStr).getMonth() + 1;
}

/**
 * Format a date string for display using LOCAL time
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDateOnly(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!dateStr) return 'N/A';
  const dt = parseDateOnlyLocal(dateStr);
  return dt.toLocaleDateString('en-US', options);
}

/**
 * Compare two date-only strings
 * Returns negative if a < b, 0 if equal, positive if a > b
 * 
 * @param a - First date string
 * @param b - Second date string
 * @returns Comparison result
 */
export function compareDateOnly(a: string, b: string): number {
  const dateA = parseDateOnlyLocal(a);
  const dateB = parseDateOnlyLocal(b);
  return dateA.getTime() - dateB.getTime();
}

/**
 * Check if a date string falls within a specific month
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @param monthKey - Month key in "YYYY-MM" format
 * @returns True if date is in the specified month
 */
export function isDateInMonth(dateStr: string, monthKey: string): boolean {
  return monthKeyFromDateOnly(dateStr) === monthKey;
}

/**
 * Get the current month key based on LOCAL time
 * 
 * @returns Current month key like "2025-12"
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get today's date as a YYYY-MM-DD string
 * 
 * @returns Today's date string
 */
export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date has passed (is before today)
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns True if date is before today
 */
export function isDatePast(dateStr: string): boolean {
  const date = parseDateOnlyLocal(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date is within N days from now
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @param days - Number of days
 * @returns True if date is within the specified days
 */
export function isDateWithinDays(dateStr: string, days: number): boolean {
  const date = parseDateOnlyLocal(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const future = new Date(now);
  future.setDate(future.getDate() + days);
  return date >= now && date <= future;
}


