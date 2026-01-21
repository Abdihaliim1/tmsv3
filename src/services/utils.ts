
import { Driver } from '../types';

// Comprehensive US city coordinates (lat, lng) for mileage calculation
const cityCoords: Record<string, { lat: number; lng: number }> = {
  // Ohio
  'columbus, oh': { lat: 39.9612, lng: -82.9988 },
  'cleveland, oh': { lat: 41.4993, lng: -81.6944 },
  'cincinnati, oh': { lat: 39.1031, lng: -84.5120 },
  'toledo, oh': { lat: 41.6528, lng: -83.5379 },
  'akron, oh': { lat: 41.0814, lng: -81.5190 },
  'dayton, oh': { lat: 39.7589, lng: -84.1916 },
  'youngstown, oh': { lat: 41.0998, lng: -80.6495 },

  // Illinois
  'chicago, il': { lat: 41.8781, lng: -87.6298 },
  'aurora, il': { lat: 41.7606, lng: -88.3201 },
  'rockford, il': { lat: 42.2711, lng: -89.0940 },
  'joliet, il': { lat: 41.5250, lng: -88.0817 },
  'springfield, il': { lat: 39.7817, lng: -89.6501 },

  // Texas
  'dallas, tx': { lat: 32.7767, lng: -96.7970 },
  'houston, tx': { lat: 29.7604, lng: -95.3698 },
  'san antonio, tx': { lat: 29.4241, lng: -98.4936 },
  'austin, tx': { lat: 30.2672, lng: -97.7431 },
  'fort worth, tx': { lat: 32.7555, lng: -97.3308 },
  'el paso, tx': { lat: 31.7619, lng: -106.4850 },
  'laredo, tx': { lat: 27.5306, lng: -99.4803 },

  // California
  'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
  'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
  'san diego, ca': { lat: 32.7157, lng: -117.1611 },
  'fresno, ca': { lat: 36.7378, lng: -119.7871 },
  'sacramento, ca': { lat: 38.5816, lng: -121.4944 },
  'oakland, ca': { lat: 37.8044, lng: -122.2712 },
  'bakersfield, ca': { lat: 35.3733, lng: -119.0187 },
  'ontario, ca': { lat: 34.0633, lng: -117.6509 },
  'stockton, ca': { lat: 37.9577, lng: -121.2908 },

  // Georgia
  'atlanta, ga': { lat: 33.7490, lng: -84.3880 },
  'savannah, ga': { lat: 32.0809, lng: -81.0912 },
  'augusta, ga': { lat: 33.4735, lng: -82.0105 },
  'macon, ga': { lat: 32.8407, lng: -83.6324 },

  // Florida
  'miami, fl': { lat: 25.7617, lng: -80.1918 },
  'orlando, fl': { lat: 28.5383, lng: -81.3792 },
  'tampa, fl': { lat: 27.9506, lng: -82.4572 },
  'jacksonville, fl': { lat: 30.3322, lng: -81.6557 },
  'fort lauderdale, fl': { lat: 26.1224, lng: -80.1373 },

  // New York
  'new york, ny': { lat: 40.7128, lng: -74.0060 },
  'buffalo, ny': { lat: 42.8864, lng: -78.8784 },
  'rochester, ny': { lat: 43.1566, lng: -77.6088 },
  'syracuse, ny': { lat: 43.0481, lng: -76.1474 },
  'albany, ny': { lat: 42.6526, lng: -73.7562 },

  // Pennsylvania
  'pittsburgh, pa': { lat: 40.4406, lng: -79.9959 },
  'philadelphia, pa': { lat: 39.9526, lng: -75.1652 },
  'harrisburg, pa': { lat: 40.2732, lng: -76.8867 },
  'allentown, pa': { lat: 40.6084, lng: -75.4902 },

  // Michigan
  'detroit, mi': { lat: 42.3314, lng: -83.0458 },
  'grand rapids, mi': { lat: 42.9634, lng: -85.6681 },
  'flint, mi': { lat: 43.0125, lng: -83.6875 },
  'lansing, mi': { lat: 42.7325, lng: -84.5555 },

  // Tennessee
  'nashville, tn': { lat: 36.1627, lng: -86.7816 },
  'memphis, tn': { lat: 35.1495, lng: -90.0490 },
  'knoxville, tn': { lat: 35.9606, lng: -83.9207 },
  'chattanooga, tn': { lat: 35.0456, lng: -85.3097 },

  // Indiana
  'indianapolis, in': { lat: 39.7684, lng: -86.1581 },
  'fort wayne, in': { lat: 41.0793, lng: -85.1394 },
  'south bend, in': { lat: 41.6764, lng: -86.2520 },
  'evansville, in': { lat: 37.9716, lng: -87.5711 },

  // Missouri
  'kansas city, mo': { lat: 39.0997, lng: -94.5786 },
  'st. louis, mo': { lat: 38.6270, lng: -90.1994 },
  'springfield, mo': { lat: 37.2090, lng: -93.2923 },

  // Kentucky
  'louisville, ky': { lat: 38.2527, lng: -85.7585 },
  'lexington, ky': { lat: 38.0406, lng: -84.5037 },

  // Colorado
  'denver, co': { lat: 39.7392, lng: -104.9903 },
  'colorado springs, co': { lat: 38.8339, lng: -104.8214 },

  // Arizona
  'phoenix, az': { lat: 33.4484, lng: -112.0740 },
  'tucson, az': { lat: 32.2226, lng: -110.9747 },

  // Nevada
  'las vegas, nv': { lat: 36.1699, lng: -115.1398 },
  'reno, nv': { lat: 39.5296, lng: -119.8138 },

  // Washington
  'seattle, wa': { lat: 47.6062, lng: -122.3321 },
  'spokane, wa': { lat: 47.6588, lng: -117.4260 },
  'tacoma, wa': { lat: 47.2529, lng: -122.4443 },

  // Oregon
  'portland, or': { lat: 45.5051, lng: -122.6750 },
  'salem, or': { lat: 44.9429, lng: -123.0351 },

  // North Carolina
  'charlotte, nc': { lat: 35.2271, lng: -80.8431 },
  'raleigh, nc': { lat: 35.7796, lng: -78.6382 },
  'greensboro, nc': { lat: 36.0726, lng: -79.7920 },

  // South Carolina
  'charleston, sc': { lat: 32.7765, lng: -79.9311 },
  'columbia, sc': { lat: 34.0007, lng: -81.0348 },

  // Virginia
  'richmond, va': { lat: 37.5407, lng: -77.4360 },
  'virginia beach, va': { lat: 36.8529, lng: -75.9780 },
  'norfolk, va': { lat: 36.8508, lng: -76.2859 },

  // Maryland
  'baltimore, md': { lat: 39.2904, lng: -76.6122 },

  // New Jersey
  'newark, nj': { lat: 40.7357, lng: -74.1724 },
  'jersey city, nj': { lat: 40.7178, lng: -74.0431 },
  'elizabeth, nj': { lat: 40.6640, lng: -74.2107 },

  // Massachusetts
  'boston, ma': { lat: 42.3601, lng: -71.0589 },
  'worcester, ma': { lat: 42.2626, lng: -71.8023 },
  'springfield, ma': { lat: 42.1015, lng: -72.5898 },

  // Minnesota
  'minneapolis, mn': { lat: 44.9778, lng: -93.2650 },
  'st. paul, mn': { lat: 44.9537, lng: -93.0900 },

  // Wisconsin
  'milwaukee, wi': { lat: 43.0389, lng: -87.9065 },
  'madison, wi': { lat: 43.0731, lng: -89.4012 },
  'green bay, wi': { lat: 44.5133, lng: -88.0133 },

  // Iowa
  'des moines, ia': { lat: 41.5868, lng: -93.6250 },
  'cedar rapids, ia': { lat: 41.9779, lng: -91.6656 },

  // Nebraska
  'omaha, ne': { lat: 41.2565, lng: -95.9345 },
  'lincoln, ne': { lat: 40.8258, lng: -96.6852 },

  // Oklahoma
  'oklahoma city, ok': { lat: 35.4676, lng: -97.5164 },
  'tulsa, ok': { lat: 36.1540, lng: -95.9928 },

  // Arkansas
  'little rock, ar': { lat: 34.7465, lng: -92.2896 },

  // Louisiana
  'new orleans, la': { lat: 29.9511, lng: -90.0715 },
  'baton rouge, la': { lat: 30.4515, lng: -91.1871 },
  'shreveport, la': { lat: 32.5252, lng: -93.7502 },

  // Alabama
  'birmingham, al': { lat: 33.5207, lng: -86.8025 },
  'montgomery, al': { lat: 32.3792, lng: -86.3077 },
  'mobile, al': { lat: 30.6954, lng: -88.0399 },

  // Mississippi
  'jackson, ms': { lat: 32.2988, lng: -90.1848 },

  // Utah
  'salt lake city, ut': { lat: 40.7608, lng: -111.8910 },

  // New Mexico
  'albuquerque, nm': { lat: 35.0844, lng: -106.6504 },

  // Kansas
  'wichita, ks': { lat: 37.6872, lng: -97.3301 },

  // Idaho
  'boise, id': { lat: 43.6150, lng: -116.2023 },

  // Connecticut
  'hartford, ct': { lat: 41.7658, lng: -72.6734 },
  'new haven, ct': { lat: 41.3083, lng: -72.9279 },
};

// Comprehensive known driving distances (highway miles - more accurate than straight-line)
const knownDistances: Record<string, number> = {
  // Columbus, OH routes
  'columbus, oh_chicago, il': 355,
  'columbus, oh_nashville, tn': 380,
  'columbus, oh_atlanta, ga': 550,
  'columbus, oh_dallas, tx': 1070,
  'columbus, oh_new york, ny': 540,
  'columbus, oh_detroit, mi': 200,
  'columbus, oh_indianapolis, in': 175,
  'columbus, oh_cleveland, oh': 145,
  'columbus, oh_cincinnati, oh': 107,
  'columbus, oh_pittsburgh, pa': 185,
  'columbus, oh_louisville, ky': 210,
  'columbus, oh_philadelphia, pa': 455,
  'columbus, oh_baltimore, md': 400,
  'columbus, oh_st. louis, mo': 420,

  // Chicago, IL routes
  'chicago, il_detroit, mi': 280,
  'chicago, il_indianapolis, in': 185,
  'chicago, il_milwaukee, wi': 92,
  'chicago, il_st. louis, mo': 300,
  'chicago, il_minneapolis, mn': 410,
  'chicago, il_kansas city, mo': 530,
  'chicago, il_nashville, tn': 475,
  'chicago, il_dallas, tx': 920,
  'chicago, il_atlanta, ga': 720,
  'chicago, il_denver, co': 1010,
  'chicago, il_los angeles, ca': 2015,
  'chicago, il_new york, ny': 790,

  // Atlanta, GA routes
  'atlanta, ga_miami, fl': 665,
  'atlanta, ga_orlando, fl': 440,
  'atlanta, ga_jacksonville, fl': 345,
  'atlanta, ga_charlotte, nc': 245,
  'atlanta, ga_nashville, tn': 250,
  'atlanta, ga_birmingham, al': 148,
  'atlanta, ga_new orleans, la': 470,
  'atlanta, ga_dallas, tx': 780,
  'atlanta, ga_houston, tx': 790,

  // Dallas, TX routes
  'dallas, tx_houston, tx': 240,
  'dallas, tx_san antonio, tx': 275,
  'dallas, tx_austin, tx': 195,
  'dallas, tx_oklahoma city, ok': 205,
  'dallas, tx_little rock, ar': 320,
  'dallas, tx_memphis, tn': 455,
  'dallas, tx_denver, co': 780,
  'dallas, tx_phoenix, az': 1065,
  'dallas, tx_los angeles, ca': 1435,
  'dallas, tx_kansas city, mo': 510,

  // Los Angeles, CA routes
  'los angeles, ca_san francisco, ca': 380,
  'los angeles, ca_san diego, ca': 120,
  'los angeles, ca_las vegas, nv': 270,
  'los angeles, ca_phoenix, az': 370,
  'los angeles, ca_denver, co': 1020,
  'los angeles, ca_seattle, wa': 1135,
  'los angeles, ca_portland, or': 965,
  'los angeles, ca_salt lake city, ut': 690,

  // New York, NY routes
  'new york, ny_boston, ma': 215,
  'new york, ny_philadelphia, pa': 95,
  'new york, ny_baltimore, md': 190,
  'new york, ny_pittsburgh, pa': 370,
  'new york, ny_washington, dc': 225,
  'new york, ny_buffalo, ny': 395,
  'new york, ny_hartford, ct': 115,

  // Houston, TX routes
  'houston, tx_san antonio, tx': 200,
  'houston, tx_new orleans, la': 350,
  'houston, tx_dallas, tx': 240,
  'houston, tx_austin, tx': 165,

  // Miami, FL routes
  'miami, fl_orlando, fl': 235,
  'miami, fl_tampa, fl': 280,
  'miami, fl_jacksonville, fl': 345,

  // Denver, CO routes
  'denver, co_salt lake city, ut': 525,
  'denver, co_phoenix, az': 600,
  'denver, co_kansas city, mo': 605,
  'denver, co_albuquerque, nm': 450,

  // Seattle, WA routes
  'seattle, wa_portland, or': 175,
  'seattle, wa_spokane, wa': 280,

  // Minneapolis, MN routes
  'minneapolis, mn_milwaukee, wi': 340,
  'minneapolis, mn_des moines, ia': 245,
  'minneapolis, mn_omaha, ne': 395,

  // Nashville, TN routes
  'nashville, tn_memphis, tn': 210,
  'nashville, tn_louisville, ky': 175,
  'nashville, tn_birmingham, al': 190,
  'nashville, tn_knoxville, tn': 180,
  'nashville, tn_st. louis, mo': 310,

  // Kansas City, MO routes
  'kansas city, mo_st. louis, mo': 250,
  'kansas city, mo_omaha, ne': 185,
  'kansas city, mo_oklahoma city, ok': 350,
  'kansas city, mo_wichita, ks': 200,
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

/**
 * Calculate road-adjusted distance using Haversine formula
 * Uses dynamic multipliers based on terrain/region for better accuracy
 */
const calculateHaversineDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number => {
  const R = 3959; // Earth radius in miles
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;

  // Dynamic road multiplier based on region and terrain
  // Mountains (Rockies, Appalachians) = higher multiplier
  // Plains (Midwest) = lower multiplier
  const avgLat = (coord1.lat + coord2.lat) / 2;
  const avgLng = (coord1.lng + coord2.lng) / 2;

  let roadMultiplier = 1.15; // Default: 15% more than straight line

  // Rocky Mountain region (-115 to -100 lng) - more winding roads
  if (avgLng > -115 && avgLng < -100) {
    roadMultiplier = 1.25;
  }
  // Appalachian region (eastern mountains)
  else if (avgLng > -85 && avgLng < -75 && avgLat > 34 && avgLat < 42) {
    roadMultiplier = 1.20;
  }
  // Great Plains / Midwest - straighter roads
  else if (avgLng > -100 && avgLng < -85 && avgLat > 35 && avgLat < 48) {
    roadMultiplier = 1.12;
  }
  // Texas corridor - good highways
  else if (avgLng > -105 && avgLng < -94 && avgLat > 26 && avgLat < 36) {
    roadMultiplier = 1.10;
  }
  // California I-5 corridor
  else if (avgLng > -125 && avgLng < -115 && avgLat > 32 && avgLat < 42) {
    roadMultiplier = 1.12;
  }
  // Northeast corridor - dense road network
  else if (avgLng > -80 && avgLng < -70 && avgLat > 38 && avgLat < 45) {
    roadMultiplier = 1.18;
  }

  return Math.round(straightLineDistance * roadMultiplier);
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
  // Convert to number if it's a string
  let amount: number;
  if (typeof grossAmount === 'string') {
    amount = parseFloat(grossAmount) || 0;
  } else if (typeof grossAmount === 'number') {
    amount = grossAmount;
  } else {
    amount = 0;
  }
  
  // Handle invalid inputs
  if (isNaN(amount) || !isFinite(amount) || amount < 0) {
    return 0;
  }

  if (!driver) {
    return amount;
  }

  // Company Driver: Company keeps 100% of revenue (Driver paid separately via payroll/settlement)
  if (driver.type === 'Company') {
      return amount;
  }

  // Owner Operator: Company keeps commission only (e.g. 12% if driver gets 88%)
  if (driver.type === 'OwnerOperator') {
      // Validate rateOrSplit - convert to number if needed
      let rateOrSplit: number = 0;
      if (driver.rateOrSplit !== undefined && driver.rateOrSplit !== null) {
        rateOrSplit = typeof driver.rateOrSplit === 'number' 
          ? driver.rateOrSplit 
          : parseFloat(String(driver.rateOrSplit)) || 0;
      } else if (driver.payPercentage !== undefined && driver.payPercentage !== null) {
        rateOrSplit = typeof driver.payPercentage === 'number'
          ? driver.payPercentage
          : parseFloat(String(driver.payPercentage)) || 0;
      }
      
      // Validate rateOrSplit value
      if (isNaN(rateOrSplit) || rateOrSplit <= 0 || rateOrSplit > 100) {
        // Default to 88% if invalid (common O/O split)
        const result = amount * 0.12; // Company keeps 12%
        return isNaN(result) || !isFinite(result) ? 0 : result;
      }
      
      const driverSplit = rateOrSplit / 100; // e.g. 0.88
      const companyCommission = 1 - driverSplit;    // e.g. 0.12
      const result = amount * companyCommission;
      
      // Ensure result is valid
      if (isNaN(result) || !isFinite(result) || result < 0) {
        return 0;
      }
      return result;
  }

  return amount;
};

export const validatePayPercentage = (percentage: number, driverType?: string): number => {
  // If percentage is > 1, assume it's stored as integer (e.g., 88) and convert to decimal (0.88)
  if (percentage > 1) {
    return percentage / 100;
  }
  // If percentage is already decimal (0-1), return as is
  return percentage;
};
