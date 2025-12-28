# Mock Data Added - Trucks, Trailers, and Drivers

**Date**: 2025-01-27  
**Status**: ✅ Complete

---

## SUMMARY

Added comprehensive mock data for trucks, trailers, and expanded the drivers list in `src/services/mockData.ts`. The data is automatically loaded when the application starts (if no existing data is found in localStorage).

---

## MOCK DATA ADDED

### ✅ Drivers (5 total - expanded from 2)

1. **John Doe** - Owner Operator (88% split)
   - ID: d1
   - Unit #101
   - License: DL123456 (OH)
   - Email: john.doe@atsfreight.com
   - Phone: (614) 555-0101

2. **Mike Smith** - Company Driver (35% split)
   - ID: d2
   - Unit #102
   - License: DL234567 (OH)
   - Email: mike.smith@atsfreight.com
   - Phone: (614) 555-0102

3. **Sarah Williams** - Company Driver (32% split)
   - ID: d3
   - Unit #103
   - License: DL345678 (OH)
   - Email: sarah.williams@atsfreight.com
   - Phone: (614) 555-0103

4. **Marcus Johnson** - Company Driver (38% split)
   - ID: d4
   - Unit #104
   - License: DL456789 (OH)
   - Email: marcus.johnson@atsfreight.com
   - Phone: (614) 555-0104

5. **Ahmed Hassan** - Owner Operator (85% split)
   - ID: d5
   - Unit #105
   - License: DL567890 (OH)
   - Email: ahmed.hassan@atsfreight.com
   - Phone: (614) 555-0105

---

### ✅ Trucks (6 total)

1. **Truck #101** - Freightliner Cascadia (2022)
   - VIN: 1FUJGHDV5DSHB1234
   - Status: Available
   - Owner Type: Owned
   - Driver: John Doe (d1)
   - Insurance/Registration: Expires 2025-12-31

2. **Truck #102** - Peterbilt 579 (2021)
   - VIN: 1XP5DB0X7KD123456
   - Status: In Transit
   - Owner Type: Owned
   - Driver: Mike Smith (d2)
   - Insurance/Registration: Expires 2025-11-30

3. **Truck #103** - Volvo VNL 760 (2023)
   - VIN: 4V4NC9EH5HN123456
   - Status: Available
   - Owner Type: Owned
   - Driver: Sarah Williams (d3)
   - Insurance/Registration: Expires 2025-12-15

4. **Truck #104** - International LT Series (2020)
   - VIN: 1HTMMALNXJH123456
   - Status: Available
   - Owner Type: Owned
   - Driver: Marcus Johnson (d4)
   - Insurance/Registration: Expires 2025-10-31

5. **Truck #105** - Kenworth T680 (2022)
   - VIN: 1FUJGHDV6DSHB5678
   - Status: In Transit
   - Owner Type: Owner Operator
   - Driver: Ahmed Hassan (d5)
   - Insurance/Registration: Expires 2025-09-30

6. **Truck #106** - Freightliner Cascadia Evolution (2021)
   - VIN: 1XP5DB0X8KD234567
   - Status: Maintenance
   - Owner Type: Leased
   - Driver: None (unassigned)
   - Insurance/Registration: Expires 2025-12-31
   - Notes: Leased truck - currently in maintenance

---

### ✅ Trailers (6 total)

1. **Trailer T101** - Dry Van (Great Dane SD-53, 2021)
   - VIN: 1V9VB5327M1234567
   - Status: In Use
   - Owner Type: Owned
   - Insurance/Registration: Expires 2025-12-31

2. **Trailer T102** - Dry Van (Utility 3000R, 2022)
   - VIN: 1V9VB5328M2345678
   - Status: Available
   - Owner Type: Owned
   - Insurance/Registration: Expires 2025-11-30

3. **Trailer T103** - Reefer (Carrier Transicold X4, 2020)
   - VIN: 1V9VB5329M3456789
   - Status: In Use
   - Owner Type: Owned
   - Insurance/Registration: Expires 2025-12-15
   - Notes: Refrigerated trailer - temperature controlled

4. **Trailer T104** - Flatbed (East Manufacturing 48ft, 2021)
   - VIN: 1V9VB5330M4567890
   - Status: Available
   - Owner Type: Owned
   - Insurance/Registration: Expires 2025-10-31
   - Notes: Flatbed trailer for oversized loads

5. **Trailer T105** - Dry Van (Wabash National Durastar, 2023)
   - VIN: 1V9VB5331M5678901
   - Status: Available
   - Owner Type: Owned
   - Insurance/Registration: Expires 2025-12-31

6. **Trailer T106** - Reefer (Thermo King SLXe, 2022)
   - VIN: 1V9VB5332M6789012
   - Status: In Use
   - Owner Type: Leased
   - Insurance/Registration: Expires 2025-09-30
   - Notes: Leased reefer trailer

---

## DATA STRUCTURE

### Driver Fields:
- ✅ Full name (firstName, lastName)
- ✅ Employee ID
- ✅ Contact info (email, phone)
- ✅ Driver type (Company vs OwnerOperator)
- ✅ Payment configuration (percentage, per mile, flat rate)
- ✅ License information (number, state, expiry)
- ✅ Unit number
- ✅ Status (active, inactive, terminated)
- ✅ Created/Updated timestamps

### Truck Fields:
- ✅ Truck number
- ✅ VIN
- ✅ Year, make, model
- ✅ Owner type (owned, leased, financed, owner_operator)
- ✅ Assigned driver ID
- ✅ Status (available, in_transit, maintenance, inactive)
- ✅ Insurance expiry
- ✅ Registration expiry
- ✅ Inspection dates (last, next)
- ✅ Notes
- ✅ Created/Updated timestamps

### Trailer Fields:
- ✅ Trailer number
- ✅ Type (Dry Van, Reefer, Flatbed, etc.)
- ✅ VIN
- ✅ Year, make, model
- ✅ Owner type (owned, leased, financed)
- ✅ Status (available, in_use, maintenance, inactive)
- ✅ Insurance expiry
- ✅ Registration expiry
- ✅ Inspection dates (last, next)
- ✅ Notes
- ✅ Created/Updated timestamps

---

## INTEGRATION

### Files Modified:
1. **`src/services/mockData.ts`**
   - Added `initialTrucks` export (6 trucks)
   - Added `initialTrailers` export (6 trailers)
   - Expanded `initialDrivers` (2 → 5 drivers)
   - Updated imports to include `Truck` and `Trailer` types

2. **`src/context/TMSContext.tsx`**
   - Updated to import `initialTrucks` and `initialTrailers`
   - Updated `trucks` state to use `initialTrucks` as default
   - Updated `trailers` state to use `initialTrailers` as default

### How It Works:
- When the application starts, `TMSContext` checks localStorage for existing data
- If no trucks/trailers/drivers are found in localStorage, it uses the mock data
- Mock data is only used on first load - subsequent loads use stored data
- Data is tenant-aware (each subdomain/company has its own isolated data)

---

## VERIFICATION

- ✅ All mock data follows the correct TypeScript interfaces
- ✅ All required fields are populated
- ✅ Driver-truck assignments are valid (driver IDs match)
- ✅ No linter errors
- ✅ Types are correctly imported and used
- ✅ TMSContext properly initializes with mock data

---

## NOTES

- **Driver-Truck Relationships**: Drivers d1-d5 are assigned to trucks t1-t5 respectively
- **Owner Types**: Mix of owned, leased, and owner_operator trucks for realistic testing
- **Trailer Types**: Mix of dry vans, reefers, and flatbeds for different load types
- **Statuses**: Mix of available, in_transit, maintenance, and in_use for realistic scenarios
- **Dates**: All expiry dates are set to future dates (2025-2026)
- **Insurance/Registration**: Properly tracked for compliance

---

**END OF DOCUMENTATION**


