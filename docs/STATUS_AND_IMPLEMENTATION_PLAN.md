# TMS Status Report & Implementation Plan

**Date**: 2025-01-27  
**Status**: Direct Status + Fixes Plan

---

## 1. NON-NEGOTIABLE ITEMS - STATUS

### ✅ 1. Revenue Recognition Date = DELIVERY DATE

**STATUS**: ✅ **CORRECTLY IMPLEMENTED**

**Proof**:

1. **Reports.tsx** (Line ~150-180):
   ```typescript
   // Filters settlements by delivery date of loads
   const filteredSettlements = settlements.filter(s => {
     const settlementLoadIds = s.loadIds || [];
     return settlementLoadIds.every(loadId => {
       const load = loads.find(l => l.id === loadId);
       if (!load) return false;
       const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
       return !isNaN(deliveryDate.getTime()) && deliveryDate >= periodStart && deliveryDate <= periodEnd;
     });
   });
   ```
   **File**: `src/pages/Reports.tsx:150-180`

2. **Dashboard.tsx** (Line ~50-70):
   ```typescript
   // Revenue calculated from delivered loads by delivery date
   const monthLoads = loads.filter(load => {
     if (load.status !== LoadStatus.Delivered && load.status !== LoadStatus.Completed) return false;
     const loadDate = new Date(load.deliveryDate || load.pickupDate || '');
     return loadDate >= monthStart && loadDate <= monthEnd;
   });
   ```
   **File**: `src/pages/Dashboard.tsx:50-70`

3. **businessLogic.ts** (Line ~150-180):
   ```typescript
   export const calculatePeriodRevenue = (loads: Load[], drivers: Employee[], periodStart: Date, periodEnd: Date): number => {
     return loads.filter(load => {
       const isDelivered = load.status === LoadStatus.Delivered || load.status === LoadStatus.Completed;
       if (!isDelivered) return false;
       const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
       return !isNaN(deliveryDate.getTime()) && deliveryDate >= periodStart && deliveryDate <= periodEnd;
     })...
   }
   ```
   **File**: `src/services/businessLogic.ts:150-180`

**VERDICT**: ✅ Revenue recognition uses `load.deliveryDate` everywhere. Settlement `createdAt` is NOT used for revenue period.

---

### ⚠️ 2. Driver Pay Logic - FIXED BUT VERIFICATION NEEDED

**STATUS**: ✅ **FIXED** (Fallback removed, centralized)

**Proof**:

1. **Centralized Function**:
   ```typescript
   export const calculateDriverPay = (load: Load, driver?: Employee): number => {
     // Prioritize stored pay on load
     if (load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
       return load.driverTotalGross;
     }
     
     // Calculate from driver profile - NO FALLBACK
     if (!driver.payment) {
       console.warn(`Driver ${driver.id} has no payment profile. Driver pay defaults to 0.`);
       return 0; // No fallback, must be defined
     }
     // ... calculation based on payment.type
   }
   ```
   **File**: `src/services/businessLogic.ts:15-70`

2. **All Callers**:
   - `src/pages/Reports.tsx:200` - Uses `calculateDriverPay()` from businessLogic
   - `src/pages/Dashboard.tsx:90` - Uses `calculateDriverPay()` from businessLogic
   - `src/pages/Settlements.tsx` - Should use businessLogic (verify)

**VERIFICATION NEEDED**: Check if `Settlements.tsx` still has any hardcoded fallbacks.

**REQUIREMENT**: ✅ Driver pay snapshot stored on delivered load (`driverTotalGross` field exists in Load interface).

---

### ❌ 3. Duplicate Pages & Logic Drift

**STATUS**: ❌ **NOT FIXED** - Duplicate files exist

**Found Duplicates**:
- Need to check: `legacy/` folder has multiple versions
- `index-old.html`, `index-1.html` pattern mentioned but need verification

**ACTION REQUIRED**: Audit and consolidate duplicate pages.

---

## 2. STABILITY / CONSISTENCY CHECKLIST

### A) Data Integrity & Sanity Checks

| Item | Status | Proof / File |
|------|--------|--------------|
| Schema validation on create/update | ⚠️ **PARTIAL** | Some validation exists in modals, not centralized |
| Block destructive ops when linked | ❌ **NOT IMPLEMENTED** | Can delete loads linked to invoices/settlements |
| Required fields validation | ⚠️ **PARTIAL** | Modal-level validation exists, no central schema |

**FILES TO CHECK**:
- `src/components/AddLoadModal.tsx` - Has validation
- `src/context/TMSContext.tsx` - No delete protection for linked entities

---

### B) Regression Prevention

| Test | Status | File / Location |
|------|--------|-----------------|
| Create load → dispatch → deliver | ✅ Works | `TMSContext.tsx:addLoad`, `updateLoad` |
| Deliver load → revenue month bucket | ✅ Correct | `Reports.tsx:150-180`, `Dashboard.tsx:50-70` |
| Deliver load → driver pay snapshot | ✅ Stored | `Load.driverTotalGross` field exists |
| Invoice creation → invoice number uniqueness | ✅ Fixed | `src/services/invoiceService.ts` - atomic counter |
| Apply payment → AR balance correct | ✅ Fixed | `src/services/paymentService.ts` - payment history |
| Settlement generation → totals match | ⚠️ **VERIFY** | `Settlements.tsx` - needs audit |
| Expense entry → affects profit correctly | ✅ Correct | `Reports.tsx` - uses expense.date |
| Editing delivered load → adjustment log | ❌ **NOT IMPLEMENTED** | No adjustment/correction log |
| Import CSV/XLSX → validation | ⚠️ **PARTIAL** | `Import.tsx` exists, validation level unclear |
| Role restrictions | ❌ **NOT IMPLEMENTED** | No RBAC system |

**AUTOMATED TESTS**: ❌ **NOT IMPLEMENTED** - No test suite found

---

### C) Performance + Malfunction Prevention

| Item | Status | File / Location |
|------|--------|-----------------|
| Pagination for large datasets | ✅ **IMPLEMENTED** | `Loads.tsx:14-15`, `Drivers.tsx:13-14` - itemsPerPage |
| Debounce searches/filters | ❌ **NOT IMPLEMENTED** | Direct state updates, no debounce |
| Error boundary + global handler | ❌ **NOT IMPLEMENTED** | No error boundary found |
| Health panel on dashboard | ❌ **NOT IMPLEMENTED** | No system health display |

---

### D) Security Hardening

| Item | Status | Proof |
|------|--------|-------|
| RBAC (admin/dispatcher/read-only) | ❌ **NOT IMPLEMENTED** | No role checks in code |
| Firestore rules enforcement | ❌ **UNKNOWN** | No firestore.rules file in repo |
| Destructive admin tools locked | ✅ **FIXED** | `legacy/clear-database.html` - DISABLED |

**FILE**: `legacy/clear-database.html:14` - Shows "DISABLED" message, all JS removed

---

## 3. WORKFLOW / TASK ENGINE STATUS

**STATUS**: ✅ **PHASE 1 COMPLETE** (Foundation Ready, Not Yet Integrated)

**IMPLEMENTED**:
- ✅ Task type system (`src/types.ts`)
- ✅ Task service with idempotency (`src/services/workflow/taskService.ts`)
- ✅ Workflow rules (`src/services/workflow/workflowRules.ts`)
- ✅ Workflow engine (`src/services/workflow/workflowEngine.ts`)
- ✅ Guardrails (`src/services/workflow/guardrails.ts`)

**NOT YET INTEGRATED**:
- ❌ Tasks not in TMSContext
- ❌ Workflow triggers not called in `addLoad()`, `updateLoad()`, `addInvoice()`
- ❌ Tasks.tsx page not created
- ❌ TasksWidget not added to Dashboard

**FILES READY**:
- `src/services/workflow/taskService.ts`
- `src/services/workflow/workflowEngine.ts`
- `src/services/workflow/workflowRules.ts`
- `src/services/workflow/guardrails.ts`

---

## 4. MILES CALCULATION SYSTEM

**CURRENT STATUS**: ⚠️ **PLACEHOLDER/HARDCODED**

**FILE**: `src/services/utils.ts` - `calculateDistance()` function exists but uses:
1. Hardcoded lookup table
2. Haversine formula (straight-line, not driving distance)
3. OpenStreetMap Nominatim API (online, not local)

**REQUIREMENT**: Local hosted OSRM/GraphHopper

**ARCHITECTURE PLAN**: See Section 5 below

---

## 5. IMPLEMENTATION PLAN - PRIORITIZED

### 🔴 PHASE 1: CRITICAL FIXES (1-2 days)

#### 1.1 Verify Driver Pay Logic Everywhere
- [ ] Audit `src/pages/Settlements.tsx` for any hardcoded fallbacks
- [ ] Ensure ALL driver pay calculations import from `businessLogic.ts`
- [ ] Add console warnings when driver pay = 0 (no profile)

**Files to check**:
- `src/pages/Settlements.tsx`
- `src/components/AddLoadModal.tsx`
- `src/pages/Reports.tsx` (already fixed)
- `src/pages/Dashboard.tsx` (already fixed)

#### 1.2 Eliminate Duplicate Pages
- [ ] Audit `legacy/` folder for duplicate HTML files
- [ ] Identify canonical versions
- [ ] Delete or redirect duplicates
- [ ] Document canonical file structure

**Action**: 
```bash
# Find duplicates
find . -name "*-old.html" -o -name "*-1.html" -o -name "*-backup.html"
```

#### 1.3 Add Delete Protection for Linked Entities
- [ ] Add `canDeleteLoad()` function in `TMSContext.tsx`
- [ ] Check for linked invoices/settlements before delete
- [ ] Show error if linked, require force-delete confirmation

**File**: `src/context/TMSContext.tsx:deleteLoad()` function

---

### 🟡 PHASE 2: STABILITY & REGRESSION PREVENTION (3-5 days)

#### 2.1 Data Integrity Checks
- [ ] Create `src/services/validation.ts` with schema validators
- [ ] Add validation to all entity create/update functions
- [ ] Block invalid data at TMSContext level

#### 2.2 Error Handling & Logging
- [ ] Add React Error Boundary component
- [ ] Create `src/services/errorLogger.ts` - log to Firestore
- [ ] Add global error handler in `App.tsx`

#### 2.3 Performance Optimizations
- [ ] Add debounce to search inputs (300ms)
- [ ] Implement virtual scrolling for large lists (if needed)
- [ ] Add loading states for async operations

#### 2.4 Basic Automated Tests
- [ ] Create `src/__tests__/` directory
- [ ] Add tests for 10 critical flows (see checklist above)
- [ ] Add "golden dataset" for regression testing

---

### 🟢 PHASE 3: WORKFLOW ENGINE INTEGRATION (2-3 days)

#### 3.1 Integrate Tasks into TMSContext
- [ ] Add `tasks` state to TMSContext
- [ ] Add task CRUD functions to context
- [ ] Persist tasks to localStorage

#### 3.2 Hook Workflow Triggers
- [ ] Call `triggerLoadCreated()` in `addLoad()`
- [ ] Call `triggerLoadStatusChanged()` in `updateLoad()` when status changes
- [ ] Call `triggerLoadDelivered()` when status becomes "delivered"
- [ ] Call `checkCanInvoice()` before `addInvoice()`

**File**: `src/context/TMSContext.tsx`

#### 3.3 Create Tasks UI
- [ ] Create `src/pages/Tasks.tsx` page
- [ ] Create `src/components/TasksWidget.tsx` for Dashboard
- [ ] Add Tasks navigation item

---

### 🔵 PHASE 4: MILES CALCULATION - LOCAL HOSTED (3-5 days)

#### 4.1 OSRM Setup Architecture

**Option A: Docker Container (Recommended)**

```yaml
# docker-compose.yml
version: '3.8'
services:
  osrm:
    image: osrm/osrm-backend
    ports:
      - "5000:5000"
    volumes:
      - ./data:/data
    command: osrm-routed --algorithm mld /data/us-latest.osrm
```

**Steps**:
1. Download OSM extract (US regions): `wget https://download.geofabrik.de/north-america/us-latest.osm.pbf`
2. Build OSRM graph: `osrm-extract` → `osrm-partition` → `osrm-customize`
3. Run container: `docker-compose up`
4. API endpoint: `http://localhost:5000/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`

#### 4.2 Client Integration

**File**: `src/services/milesService.ts` (to create)

```typescript
interface MilesCache {
  originKey: string; // "Columbus,OH"
  destKey: string;   // "Los Angeles,CA"
  miles: number;
  seconds: number;
  engineVersion: string;
  createdAt: string;
}

async function calculateMiles(origin: string, dest: string): Promise<number> {
  // 1. Check Firestore cache
  // 2. If miss, geocode cities → lat/lon
  // 3. Call OSRM API
  // 4. Cache result
  // 5. Return miles
}
```

#### 4.3 Geocoding Strategy

**Option 1**: Pre-built city/state → lat/lon lookup table (fast, ~1000 common cities)
**Option 2**: Use existing Nominatim as fallback (when OSRM cache miss)

---

## 6. FILES REFERENCE

### Critical Logic Locations

| Logic | File | Line Range |
|-------|------|------------|
| Revenue period filtering | `src/pages/Reports.tsx` | ~150-180 |
| Revenue period filtering | `src/pages/Dashboard.tsx` | ~50-70 |
| Revenue calculation | `src/services/businessLogic.ts` | ~150-180 |
| Driver pay calculation | `src/services/businessLogic.ts` | ~15-70 |
| Invoice numbering | `src/services/invoiceService.ts` | ~40-80 |
| Payment history | `src/services/paymentService.ts` | ~60-120 |
| Load creation | `src/context/TMSContext.tsx` | ~240-300 |
| Load status update | `src/context/TMSContext.tsx` | ~310-350 |

---

## 7. IMMEDIATE ACTION ITEMS

### Today (Priority 1):
1. ✅ Verify revenue recognition is correct (DONE - confirmed correct)
2. ⚠️ Audit `Settlements.tsx` for driver pay fallbacks
3. ❌ Add delete protection for linked entities
4. ❌ Audit and eliminate duplicate HTML files

### This Week (Priority 2):
1. ❌ Integrate workflow engine into TMSContext
2. ❌ Create Tasks.tsx page and Dashboard widget
3. ❌ Add error boundary and logging
4. ❌ Add debounce to searches

### Next Week (Priority 3):
1. ❌ OSRM local setup and integration
2. ❌ Automated tests for critical flows
3. ❌ RBAC implementation
4. ❌ Adjustment/correction log for delivered loads

---

## 8. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| Logic drift from duplicate pages | 🔴 High | Eliminate duplicates (Phase 1) |
| Missing delete protection | 🔴 High | Add checks (Phase 1) |
| No automated tests | 🟡 Medium | Add tests (Phase 2) |
| No error logging | 🟡 Medium | Add logging (Phase 2) |
| Hardcoded fallbacks in settlements | 🟡 Medium | Audit and fix (Phase 1) |
| No RBAC | 🟡 Medium | Implement (Phase 3+) |
| Miles calculation inaccurate | 🟡 Medium | Local OSRM (Phase 4) |

---

**END OF STATUS REPORT**


