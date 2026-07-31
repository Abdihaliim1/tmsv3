/**
 * Monthly truck insurance expense generator.
 * Creates at most one approved insurance expense per truck per YYYY-MM.
 * Does not backfill months before the truck's recurrence start / created date.
 */

import { Truck, Expense, NewExpenseInput, Driver } from '../types';

function ymKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}

function parseStart(truck: Truck): Date {
  const raw =
    truck.insuranceRecurrenceStart ||
    truck.purchaseDate ||
    truck.createdAt ||
    new Date().toISOString();
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Return expense inputs that should be created for the current calendar month
 * (and any missed months from nextGenerationDate → now), without duplicates.
 */
export function buildDueInsuranceExpenses(
  trucks: Truck[],
  expenses: Expense[],
  drivers: Driver[],
  asOf: Date = new Date()
): NewExpenseInput[] {
  const asOfMonth = monthStart(asOf);
  const created: NewExpenseInput[] = [];

  for (const truck of trucks) {
    const cost = Number(truck.monthlyInsuranceCost) || 0;
    const paidBy = truck.insurancePaidBy;
    if (cost <= 0) continue;
    if (paidBy && paidBy !== 'company' && paidBy !== 'split') continue;
    if (truck.insuranceRecurrenceActive === false) continue;
    if (truck.status === 'inactive') continue;

    const start = monthStart(parseStart(truck));
    if (start > asOfMonth) continue;

    const end = truck.insuranceRecurrenceEnd
      ? monthStart(new Date(truck.insuranceRecurrenceEnd.includes('T')
          ? truck.insuranceRecurrenceEnd
          : `${truck.insuranceRecurrenceEnd}T12:00:00`))
      : null;

    // Walk from start (or nextGeneration) through asOf month
    let cursor = truck.insuranceNextGenerationDate
      ? monthStart(new Date(truck.insuranceNextGenerationDate.includes('T')
          ? truck.insuranceNextGenerationDate
          : `${truck.insuranceNextGenerationDate}T12:00:00`))
      : start;

    if (cursor < start) cursor = start;

    while (cursor <= asOfMonth) {
      if (end && cursor > end) break;

      const key = `${truck.id}|insurance|${ymKey(cursor.getFullYear(), cursor.getMonth())}`;
      const exists = expenses.some(e => e.recurrenceKey === key) ||
        expenses.some(e =>
          e.truckId === truck.id &&
          e.type === 'insurance' &&
          (e.date || '').startsWith(ymKey(cursor.getFullYear(), cursor.getMonth()))
        );

      if (!exists) {
        const truckNumber = truck.number || truck.truckNumber || 'Unknown';
        const driverId = truck.assignedDriver || truck.ownerOperatorDriverId || truck.driverId;
        const driver = driverId ? drivers.find(d => d.id === driverId) : undefined;
        const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
        const dateStr = `${ymKey(cursor.getFullYear(), cursor.getMonth())}-01`;

        created.push({
          type: 'insurance',
          category: 'insurance',
          amount: cost,
          description: `Monthly Insurance - Truck ${truckNumber} (${monthLabel})`,
          driverId: driver?.id,
          driverName: driver ? `${driver.firstName} ${driver.lastName}` : undefined,
          truckId: truck.id,
          truckNumber,
          vendor: 'Insurance Provider',
          paidBy: 'company',
          status: 'approved',
          date: dateStr,
          isRecurring: true,
          recurrenceKey: key,
        });
      }

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  return created;
}
