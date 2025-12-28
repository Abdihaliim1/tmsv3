/**
 * IFTA Service - International Fuel Tax Agreement Reporting
 * 
 * Handles:
 * - State miles tracking
 * - Fuel purchase tracking
 * - IFTA report generation
 * - MPG calculations
 */

import { IFTAStateMiles, IFTAFuelPurchase, IFTAReport } from '../types';

/**
 * Get quarter start date
 */
export function getQuarterStart(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number): Date {
  const month = quarter === 'Q1' ? 0 : quarter === 'Q2' ? 3 : quarter === 'Q3' ? 6 : 9;
  return new Date(year, month, 1);
}

/**
 * Get quarter end date
 */
export function getQuarterEnd(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number): Date {
  const month = quarter === 'Q1' ? 2 : quarter === 'Q2' ? 5 : quarter === 'Q3' ? 8 : 11;
  const day = quarter === 'Q1' ? 31 : quarter === 'Q2' ? 30 : quarter === 'Q3' ? 30 : 31;
  return new Date(year, month, day, 23, 59, 59);
}

/**
 * Generate IFTA report
 */
export function generateIFTAReport(
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  year: number,
  stateMiles: IFTAStateMiles[],
  fuelPurchases: IFTAFuelPurchase[]
): IFTAReport {
  const quarterStart = getQuarterStart(quarter, year);
  const quarterEnd = getQuarterEnd(quarter, year);

  // Filter to quarter
  const quarterMiles = stateMiles.filter(m => {
    const date = new Date(m.date);
    return date >= quarterStart && date <= quarterEnd;
  });

  const quarterFuel = fuelPurchases.filter(f => {
    const date = new Date(f.date);
    return date >= quarterStart && date <= quarterEnd;
  });

  // Aggregate miles by state
  const milesByState: Record<string, number> = {};
  quarterMiles.forEach(m => {
    milesByState[m.state] = (milesByState[m.state] || 0) + m.miles;
  });

  // Aggregate fuel by state
  const fuelByState: Record<string, { gallons: number; cost: number }> = {};
  quarterFuel.forEach(f => {
    if (!fuelByState[f.state]) {
      fuelByState[f.state] = { gallons: 0, cost: 0 };
    }
    fuelByState[f.state].gallons += f.gallons;
    fuelByState[f.state].cost += f.cost;
  });

  // Calculate total miles and fuel
  const totalMiles = Object.values(milesByState).reduce((a, b) => a + b, 0);
  const totalGallons = Object.values(fuelByState).reduce((sum, f) => sum + f.gallons, 0);
  const mpg = totalGallons > 0 ? totalMiles / totalGallons : 0;

  // Calculate tax due per state (simplified - actual IFTA calculation requires state tax rates)
  // This is a placeholder - real IFTA tax calculation requires state-specific tax rates
  const taxDue: Record<string, number> = {};
  Object.keys(milesByState).forEach(state => {
    // Placeholder tax calculation
    // Real implementation would use state tax rates and IFTA formulas
    taxDue[state] = 0;
  });

  return {
    id: `ifta-${quarter}-${year}-${Date.now()}`,
    quarter,
    year,
    stateMiles: milesByState,
    fuelPurchases: fuelByState,
    mpg,
    taxDue,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Calculate MPG for a state
 */
export function calculateStateMPG(
  state: string,
  stateMiles: IFTAStateMiles[],
  fuelPurchases: IFTAFuelPurchase[]
): number {
  const stateMilesTotal = stateMiles
    .filter(m => m.state === state)
    .reduce((sum, m) => sum + m.miles, 0);

  const stateFuelTotal = fuelPurchases
    .filter(f => f.state === state)
    .reduce((sum, f) => sum + f.gallons, 0);

  return stateFuelTotal > 0 ? stateMilesTotal / stateFuelTotal : 0;
}


