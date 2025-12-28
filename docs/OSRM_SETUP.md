# OSRM Setup Guide

**OSRM** (Open Source Routing Machine) provides accurate driving distance calculations for the TMS.

---

## Quick Setup (Docker - Recommended)

### Prerequisites
- Docker and Docker Compose installed
- 2-4 GB free disk space for map data

### Steps

1. **Create OSRM directory structure**:
```bash
mkdir -p osrm-data
cd osrm-data
```

2. **Download map data** (US - Smaller file):
```bash
# Download US map (about 1.5GB)
wget https://download.geofabrik.de/north-america/us-latest.osm.pbf

# Or for specific state (example: Ohio - much smaller):
# wget https://download.geofabrik.de/north-america/us/ohio-latest.osm.pbf
```

3. **Extract and build routing graph**:
```bash
# Extract
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/us-latest.osm.pbf

# Contract
docker run -t -v $(pwd):/data osrm/osrm-backend osrm-contract /data/us-latest.osrm

# Start OSRM server
docker run -t -i -p 5000:5000 -v $(pwd):/data osrm/osrm-backend osrm-routed --algorithm mld /data/us-latest.osrm
```

4. **Test OSRM**:
```bash
curl "http://localhost:5000/route/v1/driving/-82.9988,39.9612;-87.6298,41.8781?overview=false"
```

### Docker Compose Setup (Alternative)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  osrm:
    image: osrm/osrm-backend
    ports:
      - "5000:5000"
    volumes:
      - ./osrm-data:/data
    command: osrm-routed --algorithm mld /data/us-latest.osrm
```

Then:
```bash
docker-compose up -d
```

---

## Integration with TMS

### Update `calculateDistance()` function

In `src/services/utils.ts`, add OSRM integration:

```typescript
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
    const osrmUrl = process.env.REACT_APP_OSRM_URL || 'http://localhost:5000';
    const response = await fetch(
      `${osrmUrl}/route/v1/driving/${originCoord.lng},${originCoord.lat};${destCoord.lng},${destCoord.lat}?overview=false`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // Distance is in meters, convert to miles
      const distanceMeters = data.routes[0].distance;
      return Math.round(distanceMeters * 0.000621371); // Convert to miles
    }
  } catch (error) {
    console.error('OSRM error:', error);
  }
  return null;
}
```

### Update main calculateDistance function

Modify `calculateDistance()` to use OSRM first, then fall back to existing methods:

```typescript
export const calculateDistance = async (
  originCity: string,
  originState: string,
  destCity: string,
  destState: string
): Promise<number> => {
  // Priority 1: Try OSRM (if configured)
  if (process.env.REACT_APP_OSRM_ENABLED === 'true') {
    const osrmDistance = await calculateDistanceOSRM(originCity, originState, destCity, destState);
    if (osrmDistance) return osrmDistance;
  }

  // Priority 2-4: Existing fallback logic (hardcoded, haversine, nominatim)
  // ... existing code ...
};
```

### Environment Variables

Add to `.env`:
```
REACT_APP_OSRM_ENABLED=true
REACT_APP_OSRM_URL=http://localhost:5000
```

---

## Production Deployment

For production, run OSRM on a separate server or use a managed service:

1. **Self-hosted**: Deploy OSRM container on a VPS
2. **Cloud**: Use cloud routing services (Mapbox, Google Maps, etc.)
3. **Caching**: Implement distance caching to reduce API calls

---

## Notes

- OSRM provides driving distances, not straight-line
- More accurate than Haversine formula
- Free and open-source
- Requires periodic map data updates
- For US-wide coverage, needs ~2GB disk space

---

**END OF OSRM SETUP GUIDE**


