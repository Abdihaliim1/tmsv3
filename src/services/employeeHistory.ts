/**
 * Employee change snapshots — preserve rate / role / status history.
 */

import { Employee, EmployeeHistoryEntry } from '../types';

const TRACKED_KEYS: Array<keyof Employee | string> = [
  'status',
  'employeeType',
  'appRole',
  'payment',
  'payType',
  'payRate',
  'rateOrSplit',
  'payPercentage',
  'dispatcherCommissionType',
  'dispatcherCommissionRate',
  'defaultCommissionType',
  'defaultCommissionRate',
];

function snapshotValue(emp: Employee, key: string): unknown {
  return (emp as Record<string, unknown>)[key];
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Build a history entry for fields that changed between before/after.
 * Returns null when nothing tracked changed.
 */
export function buildEmployeeHistoryEntry(
  before: Employee,
  after: Partial<Employee>,
  changedBy?: string
): EmployeeHistoryEntry | null {
  const fields: string[] = [];
  const beforeSnap: Record<string, unknown> = {};
  const afterSnap: Record<string, unknown> = {};

  for (const key of TRACKED_KEYS) {
    const prev = snapshotValue(before, key);
    const next = key in after ? (after as Record<string, unknown>)[key] : prev;
    if (!valuesEqual(prev, next)) {
      fields.push(key);
      beforeSnap[key] = prev;
      afterSnap[key] = next;
    }
  }

  if (fields.length === 0) return null;

  return {
    at: new Date().toISOString(),
    changedBy,
    fields,
    before: beforeSnap,
    after: afterSnap,
  };
}

export function appendEmployeeHistory(
  employee: Employee,
  updates: Partial<Employee>,
  changedBy?: string
): EmployeeHistoryEntry[] {
  const entry = buildEmployeeHistoryEntry(employee, updates, changedBy);
  const existing = employee.history || [];
  if (!entry) return existing;
  return [...existing, entry].slice(-100);
}
