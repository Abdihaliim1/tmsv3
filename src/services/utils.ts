
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

// Geocode a city using OpenStreetMap Nominatim (free, no API key required)
const geocodeCity = async (city: string, state: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const query = `${city}, ${state}, USA`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TMS-Pro-Application/1.0' // Required by Nominatim
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Calculate distance using Haversine formula
const calculateHaversineDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number => {
  const R = 3959; // Earth radius in miles
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Add 10% for road curvature estimate (straight line vs actual road distance)
  return Math.round(distance * 1.1);
};

/**
 * Calculate distance using OSRM (if available)
 */
async function calculateDistanceOSRM(
  originCity: string,
  originState: string,
  destCity: string,
  destState: string
): Promise<number | null> {
  try {
    // First, geocode cities to get coordinates
    const originCoord = await geocodeCity(originCity, originState);
    const destCoord = await geocodeCity(destCity, destState);
    
    if (!originCoord || !destCoord) return null;

    // Call OSRM API
    const osrmUrl = import.meta.env.VITE_OSRM_URL || 'http://localhost:5000';
    const response = await fetch(
      `${osrmUrl}/route/v1/driving/${originCoord.lng},${originCoord.lat};${destCoord.lng},${destCoord.lat}?overview=false`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // Distance is in meters, convert to miles
      const distanceMeters = data.routes[0].distance;
      const distanceMiles = distanceMeters * 0.000621371; // Convert meters to miles
      return Math.round(distanceMiles);
    }
  } catch (error) {
    // OSRM not available or error - fall back to other methods
    console.debug('OSRM calculation failed, using fallback:', error);
  }
  return null;
}

export const calculateDistance = async (
  originCity: string, 
  originState: string, 
  destCity: string, 
  destState: string
): Promise<number> => {
  const origin = `${originCity.trim().toLowerCase()}, ${originState.trim().toLowerCase()}`;
  const dest = `${destCity.trim().toLowerCase()}, ${destState.trim().toLowerCase()}`;
  
  const key = `${origin}_${dest}`;
  const reverseKey = `${dest}_${origin}`;

  // 1. Check Lookup Table (fastest, no API call)
  if (knownDistances[key]) return knownDistances[key];
  if (knownDistances[reverseKey]) return knownDistances[reverseKey];

  // 2. Try OSRM first (if available and configured)
  try {
    const osrmDistance = await calculateDistanceOSRM(originCity, originState, destCity, destState);
    if (osrmDistance !== null && osrmDistance > 0) {
      // Cache OSRM result for future use
      knownDistances[key] = osrmDistance;
      return osrmDistance;
    }
  } catch (error) {
    // OSRM not available, continue to fallback methods
    console.debug('OSRM not available, using fallback methods');
  }

  // 3. Check if both cities are in our coordinate cache
  const coord1 = cityCoords[origin];
  const coord2 = cityCoords[dest];

  if (coord1 && coord2) {
    return calculateHaversineDistance(coord1, coord2);
  }

  // 4. Try to geocode one or both cities and calculate
  try {
    let finalCoord1 = coord1;
    let finalCoord2 = coord2;

    // Geocode origin if not in cache
    if (!finalCoord1) {
      const geocoded = await geocodeCity(originCity, originState);
      if (geocoded) {
        finalCoord1 = geocoded;
        // Cache it for future use
        cityCoords[origin] = geocoded;
      }
    }

    // Geocode destination if not in cache
    if (!finalCoord2) {
      const geocoded = await geocodeCity(destCity, destState);
      if (geocoded) {
        finalCoord2 = geocoded;
        // Cache it for future use
        cityCoords[dest] = geocoded;
      }
    }

    // If we have both coordinates, calculate distance
    if (finalCoord1 && finalCoord2) {
      return calculateHaversineDistance(finalCoord1, finalCoord2);
    }
  } catch (error) {
    console.error('Error calculating distance:', error);
  }

  // 5. Fail safe - return 0 if we can't calculate
  return 0;
};

export const calculateCompanyRevenue = (grossAmount: number, driver?: Driver): number => {
  // Handle invalid inputs
  if (typeof grossAmount !== 'number' || isNaN(grossAmount) || grossAmount < 0) {
    return 0;
  }

  if (!driver) {
    return grossAmount;
  }

  // Company Driver: Company keeps 100% of revenue (Driver paid separately via payroll/settlement)
  if (driver.type === 'Company') {
      return grossAmount;
  }

  // Owner Operator: Company keeps commission only (e.g. 12% if driver gets 88%)
  if (driver.type === 'OwnerOperator') {
      // Validate rateOrSplit
      const rateOrSplit = driver.rateOrSplit || driver.payPercentage || 0;
      if (typeof rateOrSplit !== 'number' || isNaN(rateOrSplit) || rateOrSplit <= 0) {
        // Default to 88% if invalid (common O/O split)
        return grossAmount * 0.12; // Company keeps 12%
      }
      
      const driverSplit = rateOrSplit / 100; // e.g. 0.88
      const companyCommission = 1 - driverSplit;    // e.g. 0.12
      const result = grossAmount * companyCommission;
      
      // Ensure result is valid
      return isNaN(result) ? 0 : result;
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
