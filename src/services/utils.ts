
import { Driver } from '../types';

// Major city coordinates (lat, lng) for fallback calculation
const cityCoords: Record<string, { lat: number; lng: number }> = {
  'columbus, oh': { lat: 39.9612, lng: -82.9988 },
  'chicago, il': { lat: 41.8781, lng: -87.6298 },
  'dallas, tx': { lat: 32.7767, lng: -96.7970 },
  'atlanta, ga': { lat: 33.7490, lng: -84.3880 },
  'phoenix, az': { lat: 33.4484, lng: -112.0740 },
  'new york, ny': { lat: 40.7128, lng: -74.0060 },
  'detroit, mi': { lat: 42.3314, lng: -83.0458 },
  'nashville, tn': { lat: 36.1627, lng: -86.7816 },
  'cleveland, oh': { lat: 41.4993, lng: -81.6944 },
  'cincinnati, oh': { lat: 39.1031, lng: -84.5120 },
  'indianapolis, in': { lat: 39.7684, lng: -86.1581 },
  'pittsburgh, pa': { lat: 40.4406, lng: -79.9959 },
  'louisville, ky': { lat: 38.2527, lng: -85.7585 },
  'memphis, tn': { lat: 35.1495, lng: -90.0490 },
  'kansas city, mo': { lat: 39.0997, lng: -94.5786 },
  'denver, co': { lat: 39.7392, lng: -104.9903 },
  'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
  'houston, tx': { lat: 29.7604, lng: -95.3698 },
  'miami, fl': { lat: 25.7617, lng: -80.1918 },
};

// Hardcoded distances for specific routes (from your old app)
const knownDistances: Record<string, number> = {
  'columbus, oh_chicago, il': 355,
  'columbus, oh_nashville, tn': 380,
  'columbus, oh_atlanta, ga': 550,
  'columbus, oh_dallas, tx': 930,
  'columbus, oh_new york, ny': 580,
  'columbus, oh_detroit, mi': 200,
  'chicago, il_detroit, mi': 280,
  'atlanta, ga_miami, fl': 665,
};

export const calculateDistance = (originCity: string, originState: string, destCity: string, destState: string): number => {
  const origin = `${originCity.trim().toLowerCase()}, ${originState.trim().toLowerCase()}`;
  const dest = `${destCity.trim().toLowerCase()}, ${destState.trim().toLowerCase()}`;
  
  const key = `${origin}_${dest}`;
  const reverseKey = `${dest}_${origin}`;

  // 1. Check Lookup Table
  if (knownDistances[key]) return knownDistances[key];
  if (knownDistances[reverseKey]) return knownDistances[reverseKey];

  // 2. Fallback: Coordinate Calculation (Haversine)
  const coord1 = cityCoords[origin];
  const coord2 = cityCoords[dest];

  if (coord1 && coord2) {
      const R = 3959; // Earth radius in miles
      const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
      const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      // Add 10% for road curvature estimate
      return Math.round(distance * 1.1);
  }

  // 3. Fail safe
  return 0;
};

export const calculateCompanyRevenue = (grossAmount: number, driver?: Driver): number => {
  if (!driver || !grossAmount) return grossAmount || 0;

  // Company Driver: Company keeps 100% of revenue (Driver paid separately via payroll/settlement)
  if (driver.type === 'Company') {
      return grossAmount;
  }

  // Owner Operator: Company keeps commission only (e.g. 12% if driver gets 88%)
  if (driver.type === 'OwnerOperator') {
      const driverSplit = driver.rateOrSplit / 100; // e.g. 0.88
      const companyCommission = 1 - driverSplit;    // e.g. 0.12
      return grossAmount * companyCommission;
  }

  return grossAmount;
};

export const validatePayPercentage = (percentage: number, driverType?: string): number => {
  // If percentage is > 1, assume it's stored as integer (e.g., 88) and convert to decimal (0.88)
  if (percentage > 1) {
    return percentage / 100;
  }
  // If percentage is already decimal (0-1), return as is
  return percentage;
};
