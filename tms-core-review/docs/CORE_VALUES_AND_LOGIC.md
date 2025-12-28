# TMS Pro - Core Values, Logic, and Architecture

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Model & Types](#data-model--types)
3. [Multi-Tenant System](#multi-tenant-system)
4. [Revenue Recognition](#revenue-recognition)
5. [Driver Pay Calculation](#driver-pay-calculation)
6. [Settlement Logic](#settlement-logic)
7. [Expense Handling](#expense-handling)
8. [Profit & Loss Reporting](#profit--loss-reporting)
9. [Factoring System](#factoring-system)
10. [Broker System](#broker-system)
11. [Status Workflows](#status-workflows)
12. [Date & Period Filtering](#date--period-filtering)
13. [Data Storage](#data-storage)
14. [Authentication](#authentication)
15. [Key Utilities](#key-utilities)
16. [UI Patterns](#ui-patterns)
17. [PDF Generation](#pdf-generation)

---

## System Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Data Persistence**: localStorage (tenant-aware)
- **PDF Generation**: jsPDF
- **Charts**: Recharts

### Project Structure
```
src/
├── components/          # Reusable UI components
├── context/            # React Context providers (TMS, Tenant, Company, Auth)
├── pages/              # Main page components
├── services/           # Business logic and utilities
├── types.ts            # TypeScript type definitions
└── utils/              # Helper utilities
```

### Context Providers Hierarchy
```
App
└── AuthProvider          # Authentication state
    └── TenantProvider    # Multi-tenant isolation
        └── CompanyProvider  # Company branding/settings
            └── TMSProvider   # Core business data (loads, drivers, etc.)
```

---

## Data Model & Types

### Core Entities

#### Load
```typescript
interface Load {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  // Driver Assignment
  driverId?: string;
  driverName?: string;
  // Team Driver Support
  isTeamLoad?: boolean;
  driver2Id?: string;
  driver2Name?: string;
  // Location & Route
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  miles: number;
  pickupDate: string;
  deliveryDate: string;
  // Financial
  rate: number;                    // Base rate from broker
  grandTotal: number;               // rate + accessorials
  // Driver Pay (stored on load for accuracy)
  driverBasePay?: number;          // Base pay (rate × driver %)
  driverDetentionPay?: number;     // 100% pass-through
  driverLayoverPay?: number;        // 100% pass-through
  driverTotalGross?: number;       // Total driver gross pay
  // Broker
  brokerId?: string;
  brokerName?: string;
  brokerReference?: string;
  // Factoring
  isFactored?: boolean;
  factoringCompanyId?: string;
  factoringFee?: number;           // Auto-calculated: grandTotal × fee%
  factoringFeePercent?: number;    // Fee percentage (e.g., 2.5 for 2.5%)
  factoredAmount?: number;          // Auto-calculated: grandTotal - fee
  // Dispatcher
  dispatcherId?: string;
  dispatcherCommissionAmount?: number;
  // Accessorials
  detentionAmount?: number;
  layoverAmount?: number;
  tonuFee?: number;
  // Dates
  createdAt?: string;
  updatedAt?: string;
}
```

#### Employee (Driver/Dispatcher)
```typescript
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeType: 'driver' | 'dispatcher';
  type: 'Company' | 'OwnerOperator';
  status: 'active' | 'inactive' | 'on_leave';
  // Payment Configuration
  payment?: {
    type: 'percentage' | 'per_mile' | 'flat_rate';
    percentage?: number;        // 0-1 (e.g., 0.35 for 35%)
    perMileRate?: number;       // $ per mile
    flatRate?: number;          // Fixed amount
  };
  payPercentage?: number;       // Legacy: stored as 0-1 or 0-100
  rateOrSplit?: number;         // Legacy: O/O split (e.g., 88 for 88%)
}
```

#### Settlement
```typescript
interface Settlement {
  id: string;
  settlementNumber?: string;
  type?: 'driver' | 'dispatcher';
  driverId?: string;
  driverName: string;
  // Loads included in settlement
  loadId?: string;              // Legacy: single load
  loadIds?: string[];            // Multiple loads
  loads?: Array<{
    loadId: string;
    basePay?: number;
    detention?: number;
    layover?: number;
    tonu?: number;
  }>;
  // Financial
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  // Period
  periodStart?: string;
  periodEnd?: string;
  // Dates
  date?: string;
  createdAt?: string;
}
```

#### Broker
```typescript
interface Broker {
  id: string;
  name: string;
  aliases?: string[];            // e.g., ["TQL", "Total Quality"]
  searchKey: string;              // Normalized search text
  prefixes: string[];             // For fast autocomplete
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
}
```

#### FactoringCompany
```typescript
interface FactoringCompany {
  id: string;
  name: string;
  aliases?: string[];            // e.g., ["TAFS", "TransAm"]
  searchKey: string;              // Normalized search text
  prefixes: string[];             // For fast autocomplete
  feePercentage?: number;        // Default fee % (e.g., 2.5 for 2.5%)
  contactName?: string;
  phone?: string;
  email?: string;
}
```

---

## Multi-Tenant System

### Tenant Detection
- **Method**: Subdomain-based (e.g., `atsfreight.asal.llc`, `sample.asal.llc`)
- **Location**: `src/utils/tenant.ts` - `getTenantFromSubdomain()`
- **Storage Key Pattern**: `tms_{tenantId}_{dataType}`

### Data Isolation
All data is stored in `localStorage` with tenant-aware keys:
```typescript
// Pattern: tms_{tenantId}_{dataType}
const storageKey = `tms_${tenantId}_loads`;
const storageKey = `tms_${tenantId}_drivers`;
const storageKey = `tms_${tenantId}_brokers`;
// etc.
```

### Tenant-Specific Defaults
- Company branding can be set per tenant
- Each tenant has isolated data (loads, drivers, expenses, etc.)
- No cross-tenant data access

---

## Revenue Recognition

### Core Principle
**Revenue is recognized when loads are DELIVERED, not when settlements are created.**

### Revenue Calculation by Driver Type

#### Company Driver
```typescript
// Company gets 100% of load amount
companyRevenue = load.grandTotal || load.rate;
```

#### Owner Operator
```typescript
// Company gets commission only (e.g., 12% if driver gets 88%)
const driverSplit = driver.rateOrSplit / 100;  // e.g., 0.88
const companyCommission = 1 - driverSplit;    // e.g., 0.12
companyRevenue = load.grandTotal * companyCommission;
```

### Implementation
**Location**: `src/services/utils.ts` - `calculateCompanyRevenue()`

```typescript
export const calculateCompanyRevenue = (grossAmount: number, driver?: Driver): number => {
  if (!driver || !grossAmount) return grossAmount || 0;
  
  if (driver.type === 'Company') {
    return grossAmount;  // 100% revenue
  }
  
  if (driver.type === 'OwnerOperator') {
    const driverSplit = driver.rateOrSplit / 100;
    const companyCommission = 1 - driverSplit;
    return grossAmount * companyCommission;
  }
  
  return grossAmount;
};
```

---

## Driver Pay Calculation

### Core Principle
**Driver pay is calculated from the driver's payment profile, not a fixed percentage.**

### Payment Types

#### 1. Percentage-Based
```typescript
// Driver gets X% of load rate
driverBasePay = load.rate × driver.payment.percentage
// Example: $1,200 × 0.35 = $420
```

#### 2. Per-Mile
```typescript
// Driver gets $X per mile
driverBasePay = load.miles × driver.payment.perMileRate
// Example: 350 miles × $1.20/mile = $420
```

#### 3. Flat Rate
```typescript
// Driver gets fixed amount per load
driverBasePay = driver.payment.flatRate
// Example: $500 flat rate
```

### Accessorials (100% Pass-Through)
- **Detention**: 100% to driver
- **Layover**: 100% to driver
- **TONU**: 100% to driver

### Total Driver Pay Formula
```typescript
driverTotalGross = driverBasePay + driverDetentionPay + driverLayoverPay + tonuFee
```

### Implementation Priority
1. **First**: Use stored `driverTotalGross` or `driverBasePay` from load (most accurate)
2. **Second**: Calculate from driver's payment profile
3. **Fallback**: Use defaults if no profile found

**Location**: `src/components/AddLoadModal.tsx` (lines 369-357)
**Location**: `src/pages/Reports.tsx` (lines 130-200)
**Location**: `src/pages/Dashboard.tsx` (lines 162-256)

---

## Settlement Logic

### Settlement Creation
- **Purpose**: Payment record for drivers/dispatchers
- **Not a Revenue Trigger**: Settlement creation does NOT affect revenue recognition
- **Load-Based**: Settlements contain one or more loads

### Settlement Calculation

#### Gross Pay
```typescript
grossPay = Σ(load.driverBasePay) + Σ(load.driverDetentionPay) + Σ(load.driverLayoverPay) + Σ(load.tonuFee)
```

#### Deductions (Company Drivers)
```typescript
totalDeductions = 
  advances +
  lumperFees +
  taxes (federal + state + local + medicare + socialSecurity)
```

#### Deductions (Owner Operators)
```typescript
totalDeductions = 
  advances +
  lumperFees +
  expenses (if driver chose to deduct) +
  // NO TAXES (O/O are 1099 contractors)
```

#### Net Pay
```typescript
netPay = grossPay - totalDeductions
```

### Settlement Period
- Settlements can be created for any period (week, month, custom)
- Period is defined by `periodStart` and `periodEnd` dates
- Loads are included based on their delivery dates, not settlement creation date

---

## Expense Handling

### Expense Types
- **Fuel**: Company truck fuel expenses
- **Insurance**: Monthly insurance allocations
- **Tolls**: Road tolls
- **Maintenance**: Truck repairs/maintenance
- **Permits**: IRP, IFTA, UCR, etc.
- **ELD**: Electronic logging device fees
- **Parking**: Parking fees
- **Other**: Miscellaneous expenses

### Expense Allocation

#### Company Drivers
- **paidBy**: Always `'company'`
- **deductFromDriver**: Always `false`
- Expenses are company costs, NOT driver deductions

#### Owner Operators
- **paidBy**: `'company'` or `'owner_operator'`
- **deductFromDriver**: Based on driver's deduction preferences
- O/O-paid expenses are pass-through costs (not company expenses)

### Expense Filtering in Reports
```typescript
// Only include expenses:
// 1. Paid by company (paidBy === 'company')
// 2. In the report period (expense.date within period)
// 3. NOT O/O pass-through expenses (fuel, insurance, tolls paid by O/O)
```

---

## Profit & Loss Reporting

### Core Principles

1. **Revenue Recognition**: Based on load delivery date, NOT settlement creation date
2. **Period Filtering**: All data filtered by actual transaction dates
3. **Settlement Independence**: Creating settlements doesn't trigger revenue

### Revenue Calculation
```typescript
// Only count loads delivered in the period
revenueLoads = loads.filter(load => 
  (load.status === 'Delivered' || load.status === 'Completed') &&
  load.deliveryDate >= periodStart &&
  load.deliveryDate <= periodEnd
);

// Calculate revenue by driver type
revenueLoads.forEach(load => {
  const companyRevenue = calculateCompanyRevenue(load.grandTotal, driver);
  totalRevenue += companyRevenue;
});
```

### Driver Pay Calculation

#### Priority 1: Use Settlements (Most Accurate)
```typescript
// Only count settlements where ALL loads were delivered in the period
periodSettlements = settlements.filter(settlement => {
  const settlementLoadIds = [...settlement.loadIds, ...settlement.loads.map(l => l.loadId)];
  return settlementLoadIds.every(loadId => 
    revenueLoads.some(load => load.id === loadId)
  );
});

// Sum net pay from settlements
periodSettlements.forEach(settlement => {
  if (driver.type === 'OwnerOperator') {
    ownerOperatorPay += settlement.grossPay;
  } else {
    companyDriverPay += settlement.netPay;
  }
});
```

#### Priority 2: Estimate from Loads
```typescript
// If no settlements, calculate from driver's payment profile
revenueLoads.forEach(load => {
  // Use stored driver pay if available
  if (load.driverTotalGross) {
    driverPay = load.driverTotalGross;
  } else {
    // Calculate from driver's payment profile
    if (driver.payment?.type === 'percentage') {
      driverPay = load.rate × driver.payment.percentage;
    } else if (driver.payment?.type === 'per_mile') {
      driverPay = load.miles × driver.payment.perMileRate;
    } else if (driver.payment?.type === 'flat_rate') {
      driverPay = driver.payment.flatRate;
    }
  }
});
```

### Expense Calculation
```typescript
// Only count expenses from the period
filteredExpenses = expenses.filter(expense => 
  expense.date >= periodStart &&
  expense.date <= periodEnd &&
  expense.paidBy === 'company' &&
  // Exclude O/O pass-through expenses
  !(expense.driverId && driver.type === 'OwnerOperator' && isPassThroughExpense(expense))
);
```

### Net Profit Formula
```typescript
netProfit = totalRevenue - totalExpenses - totalDriverPay
profitMargin = (netProfit / totalRevenue) × 100
```

### Implementation Locations
- **Reports Page**: `src/pages/Reports.tsx` (lines 47-495)
- **Dashboard**: `src/pages/Dashboard.tsx` (lines 119-259)

---

## Factoring System

### Factoring Fee Calculation
```typescript
// Auto-calculated when factoring company is selected
factoringFee = grandTotal × (feePercentage / 100)
factoredAmount = grandTotal - factoringFee

// Example: $1,200 load × 1% = $12 fee, $1,188 received
```

### Factoring Company Selection
- **Autocomplete**: Uses `FactoringCompanyAutocomplete` component
- **Auto-Seeding**: 50 factoring companies pre-loaded on first load
- **Aliases**: Supports shortcuts (TAFS, TAB, WEX, OTR)
- **Prefix Search**: Fast typeahead using prefix matching

### Factoring Fee Auto-Calculation
**Location**: `src/components/AddLoadModal.tsx` (lines 298-333)

```typescript
// When factoring company selected or fee % entered
useEffect(() => {
  if (formData.isFactored && formData.grandTotal > 0) {
    const selectedCompany = factoringCompanies.find(fc => fc.id === formData.factoringCompanyId);
    const feePercentage = formData.factoringFeePercent || selectedCompany?.feePercentage || 0;
    
    if (feePercentage > 0) {
      const fee = formData.grandTotal * (feePercentage / 100);
      const factoredAmount = formData.grandTotal - fee;
      
      setFormData(prev => ({
        ...prev,
        factoringFee: fee,
        factoringFeePercent: feePercentage,
        factoredAmount: factoredAmount
      }));
    }
  }
}, [formData.isFactored, formData.grandTotal, formData.factoringCompanyId, formData.factoringFeePercent, factoringCompanies]);
```

---

## Broker System

### Broker Autocomplete
- **Component**: `src/components/BrokerAutocomplete.tsx`
- **Search Method**: Prefix-based matching
- **Normalization**: Uppercase, remove punctuation, collapse spaces
- **Prefix Generation**: 1-10 character prefixes for fast search

### Broker Data Structure
```typescript
interface Broker {
  id: string;
  name: string;
  aliases?: string[];        // e.g., ["TQL", "Total Quality"]
  searchKey: string;         // Normalized: "TOTAL QUALITY LOGISTICS TQL"
  prefixes: string[];        // ["T", "TO", "TOT", "TOTA", ...]
}
```

### Search Logic
```typescript
// Priority 1: Exact prefix match (starts with query)
// Priority 2: Partial match (contains query)
// Sorted alphabetically within each priority
```

### Auto-Seeding
- **Location**: `src/services/brokerSeed.ts`
- **Trigger**: Auto-runs when TMSContext initializes if no brokers found
- **Count**: 200+ brokers pre-loaded
- **Aliases**: Common shortcuts (TQL, JB HUNT, CHRW, RXO)

---

## Status Workflows

### Load Status Enum
```typescript
enum LoadStatus {
  Available = 'available',
  Dispatched = 'dispatched',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Completed = 'completed',
  Cancelled = 'cancelled',
  TONU = 'tonu'
}
```

### Status Change Rules
- **Available** → **Dispatched**: When driver assigned
- **Dispatched** → **In Transit**: When truck starts moving
- **In Transit** → **Delivered**: When load delivered
- **Delivered** → **Completed**: Final status (can create invoice)
- **Any** → **Cancelled**: Load cancelled (requires confirmation)
- **Any** → **TONU**: Turned down, not used (requires confirmation)

### Status History
Every status change is tracked:
```typescript
statusHistory: [{
  status: LoadStatus,
  timestamp: string,
  changedBy: string,
  note?: string
}]
```

### Status in UI
- **Location**: `src/pages/Loads.tsx` (column 2, editable dropdown)
- **Quick Update**: Can change status directly from list view
- **Color-Coded**: Each status has distinct color

---

## Date & Period Filtering

### Core Principle
**All reports filter by actual transaction dates, NOT record creation dates.**

### Revenue Filtering
```typescript
// Filter loads by DELIVERY DATE (not creation date)
filteredLoads = loads.filter(load => {
  const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
  return deliveryDate >= periodStart && deliveryDate <= periodEnd;
});

// Only count delivered/completed loads
revenueLoads = filteredLoads.filter(load => 
  load.status === 'Delivered' || load.status === 'Completed'
);
```

### Settlement Filtering
```typescript
// Filter settlements by LOAD DELIVERY DATES (not settlement creation date)
filteredSettlements = settlements.filter(settlement => {
  const settlementLoadIds = [...settlement.loadIds, ...settlement.loads.map(l => l.loadId)];
  const settlementLoads = loads.filter(l => settlementLoadIds.includes(l.id));
  
  // Include if ANY load was delivered in period
  return settlementLoads.some(load => {
    const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
    return deliveryDate >= periodStart && deliveryDate <= periodEnd;
  });
});

// Only count settlements where ALL loads are in revenueLoads
periodSettlements = filteredSettlements.filter(settlement => {
  const settlementLoadIds = [...settlement.loadIds, ...settlement.loads.map(l => l.loadId)];
  return settlementLoadIds.every(loadId => 
    revenueLoads.some(load => load.id === loadId)
  );
});
```

### Expense Filtering
```typescript
// Filter expenses by EXPENSE DATE (not creation date)
filteredExpenses = expenses.filter(expense => {
  const expDate = new Date(expense.date || expense.createdAt || '');
  return expDate >= periodStart && expDate <= periodEnd;
});
```

### Period Types
- **current_month**: First day of current month to today
- **last_month**: First day to last day of previous month
- **current_quarter**: First day of current quarter to today
- **current_year**: January 1 to today
- **all_time**: No date filtering

---

## Data Storage

### Storage Method
- **Technology**: `localStorage` (browser-based)
- **Persistence**: Data persists across browser sessions
- **Tenant-Aware**: All keys prefixed with tenant ID

### Storage Key Pattern
```typescript
const getStorageKey = (key: string, tenantId: string | null): string => {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}${key}`;
};

// Examples:
// tms_atsfreight_loads
// tms_atsfreight_drivers
// tms_sample_brokers
```

### Data Types Stored
- `loads`: Array of Load objects
- `drivers`: Array of Employee objects (type='driver')
- `employees`: Array of Employee objects (all types)
- `invoices`: Array of Invoice objects
- `settlements`: Array of Settlement objects
- `trucks`: Array of Truck objects
- `trailers`: Array of Trailer objects
- `expenses`: Array of Expense objects
- `factoringCompanies`: Array of FactoringCompany objects
- `brokers`: Array of Broker objects
- `companySettings`: CompanySettings object

### Auto-Seeding
- **Brokers**: Auto-seeded on first load (200+ brokers)
- **Factoring Companies**: Auto-seeded on first load (50 companies)
- **Location**: `src/context/TMSContext.tsx` (initialization)

---

## Authentication

### Authentication System
- **Type**: Basic authentication with hardcoded credentials
- **Location**: `src/context/AuthContext.tsx`
- **Session**: Stored in `localStorage` as `tms_auth_user`

### Valid Credentials
```typescript
const VALID_CREDENTIALS = {
  username: 'Abdihaliim',
  password: 'Abdi1234'
};
```

### Session Management
- **Login**: Stores user data in `localStorage`
- **Logout**: Clears user data from state and `localStorage`
- **Session Check**: Validates session on app mount

### Route Protection
- **Location**: `src/App.tsx`
- **Logic**: Redirects to Login if not authenticated
- **Protected Routes**: All pages except Login

---

## Key Utilities

### Distance Calculation
**Location**: `src/services/utils.ts` - `calculateDistance()`

**Strategy**:
1. **Hardcoded Lookup**: Check `knownDistances` table
2. **Coordinate Cache**: Use cached city coordinates
3. **Geocoding**: Fetch from OpenStreetMap Nominatim (free, no API key)
4. **Haversine Formula**: Calculate distance between coordinates
5. **Buffer**: Add 10% for road curvature

```typescript
export const calculateDistance = async (
  originCity: string,
  originState: string,
  destCity: string,
  destState: string
): Promise<number>
```

### Pay Percentage Validation
**Location**: `src/services/utils.ts` - `validatePayPercentage()`

```typescript
// Converts integer (88) to decimal (0.88) if needed
export const validatePayPercentage = (percentage: number, driverType?: string): number => {
  if (percentage > 1) {
    return percentage / 100;  // Convert 88 to 0.88
  }
  return percentage;  // Already decimal
};
```

### Broker Utilities
**Location**: `src/services/brokerUtils.ts`

- **normalize()**: Uppercase, remove punctuation, collapse spaces
- **generatePrefixes()**: Creates 1-10 character prefixes for fast search
- **generateSearchKey()**: Combines name + aliases, normalizes
- **searchBrokers()**: Filters and sorts brokers by query

---

## UI Patterns

### Modal Event Propagation Fix
**Issue**: Clicks inside modals were bubbling to backdrop, causing unexpected closes.

**Solution**: Add `onClick={(e) => e.stopPropagation()}` to modal content div.

**Applied To**:
- `AddLoadModal.tsx`
- `AddDriverModal.tsx`
- `Fleet.tsx` (Truck/Trailer modals)
- `FactoringCompanies.tsx`
- `Drivers.tsx`

### Autocomplete Pattern
Both Broker and FactoringCompany autocomplete follow same pattern:
1. **Prefix-based search**: Fast typeahead
2. **Keyboard navigation**: Arrow keys, Enter, Escape
3. **Add new option**: If not found, can add on-the-fly
4. **Empty states**: Clear messaging when no data

### Status Dropdown
- **Location**: `src/pages/Loads.tsx` (column 2)
- **Type**: Editable dropdown (not badge)
- **Color-Coded**: Matches status color scheme
- **Quick Update**: Changes status immediately

---

## PDF Generation

### Settlement PDF Structure
**Location**: `src/services/settlementPDF.ts`

### Drawing Primitives
Reusable drawing functions for consistent layout:
- `drawFilledBar()`: Colored background bars
- `drawBox()`: Bordered boxes
- `drawText()`: Formatted text with alignment
- `drawLogoPlaceholder()`: Logo area
- `drawSectionLabelBar()`: Section headers
- `drawTwoColumnPanels()`: Side-by-side panels
- `drawTableHeader()`: Table headers
- `drawTableRow()`: Table rows with alternating colors
- `drawTotalsBand()`: Summary bands
- `drawSummaryBox()`: Highlighted summary boxes
- `ensurePageSpace()`: Page break handling

### PDF Sections (Driver Settlement)
1. **Header**: Logo (left) + Company Info (right)
2. **Payment For**: Driver info + Settlement details
3. **Load Details Table**: All loads in settlement
4. **Earnings**: Detention, TONU, Layover
5. **Other Earnings**: Additional earnings
6. **Deductions Matrix**: Owner Operator (15 cols) or Company Driver (5 cols)
7. **Summary Boxes**: Total Deductions, Net Pay
8. **YTD Summary**: Year-to-date totals
9. **Footer**: Thank you message + disclaimers

### Design Constants
```typescript
const FONT_SIZES = {
  title: 14,
  small: 7,
  body: 8,
  header: 9,
  tableHeader: 8,
  tableData: 7,
  totalsTitle: 10,
  totalsValue: 12,
};

const COLORS = {
  blue: [30, 144, 255],
  blueSoft: [232, 244, 252],
  grayRow: [245, 245, 245],
  border: [200, 200, 200],
  text: [0, 0, 0],
  white: [255, 255, 255],
};
```

---

## Critical Business Rules

### 1. Revenue Recognition
- ✅ Revenue recognized when load is **DELIVERED** (status = Delivered/Completed)
- ❌ Revenue NOT recognized when settlement is created
- ✅ Period filtering uses **delivery date**, not creation date

### 2. Driver Pay Calculation
- ✅ Uses driver's **actual payment profile** (percentage, per_mile, flat_rate)
- ✅ Priority: Stored pay from load → Calculate from profile → Defaults
- ✅ Accessorials (detention, layover, TONU) are 100% pass-through

### 3. Settlement Timing
- ✅ Settlements can be created **anytime** (past, present, future)
- ✅ Settlement creation does **NOT** affect revenue recognition
- ✅ Reports filter settlements by **load delivery dates**, not settlement creation date

### 4. Expense Allocation
- ✅ Company drivers: Expenses are company costs (NOT deducted from driver)
- ✅ Owner operators: Expenses can be pass-through (deducted from driver) or company-paid
- ✅ O/O pass-through expenses are NOT company expenses in P&L

### 5. Multi-Tenant Isolation
- ✅ All data stored with tenant-aware keys
- ✅ No cross-tenant data access
- ✅ Each tenant has isolated branding

### 6. Period Filtering
- ✅ **Revenue**: Filtered by load delivery date
- ✅ **Driver Pay**: Filtered by load delivery dates in settlements
- ✅ **Expenses**: Filtered by expense date
- ❌ **NOT** filtered by record creation dates

### 7. Factoring Fee Calculation
- ✅ Auto-calculated: `grandTotal × (feePercentage / 100)`
- ✅ Factored amount: `grandTotal - factoringFee`
- ✅ Uses factoring company's default fee % if available

### 8. Broker/Factoring Company Autocomplete
- ✅ Prefix-based search for fast typeahead
- ✅ Supports aliases (TQL, TAFS, TAB, etc.)
- ✅ Can add new companies on-the-fly
- ✅ Auto-seeded on first load

---

## Code Conventions

### React Hooks Order
- **Rule**: All hooks must be called unconditionally at the top level
- **Error**: Conditional hooks cause "Rendered more hooks" error
- **Fix**: Move hooks before early returns

### State Management
- **Global State**: React Context (TMSContext, CompanyContext, TenantContext, AuthContext)
- **Local State**: useState for component-specific state
- **Derived State**: useMemo for calculated values

### Type Safety
- **TypeScript**: All components and functions are typed
- **Interfaces**: Defined in `src/types.ts`
- **Enums**: Used for status types (LoadStatus, InvoiceStatus)

### Error Handling
- **Try-Catch**: Used for async operations (geocoding, distance calculation)
- **Fallbacks**: Default values provided for missing data
- **Validation**: Input validation before calculations

---

## Important File Locations

### Core Business Logic
- `src/services/utils.ts`: Distance calculation, revenue calculation, pay validation
- `src/services/settlementPDF.ts`: PDF generation
- `src/services/brokerUtils.ts`: Broker search and normalization
- `src/services/brokerSeed.ts`: Broker auto-seeding
- `src/services/factoringCompanySeed.ts`: Factoring company auto-seeding

### Context Providers
- `src/context/TMSContext.tsx`: Core business data (loads, drivers, etc.)
- `src/context/TenantContext.tsx`: Multi-tenant isolation
- `src/context/CompanyContext.tsx`: Company branding/settings
- `src/context/AuthContext.tsx`: Authentication

### Key Pages
- `src/pages/Reports.tsx`: Profit & Loss reports
- `src/pages/Dashboard.tsx`: Dashboard with net profit calculation
- `src/pages/Loads.tsx`: Load management with status dropdown
- `src/pages/Settlements.tsx`: Settlement creation and PDF generation
- `src/pages/AccountReceivables.tsx`: Invoices and factoring companies

### Key Components
- `src/components/AddLoadModal.tsx`: Load creation/editing with auto-calculations
- `src/components/BrokerAutocomplete.tsx`: Broker search component
- `src/components/FactoringCompanyAutocomplete.tsx`: Factoring company search
- `src/components/Header.tsx`: Navigation and user menu

---

## Development Notes

### Port Configuration
- **Development Server**: Port 2811 (configured in `vite.config.ts`)
- **Script**: `start-localhost.sh` for easy startup

### Build Process
- **Command**: `npm run build`
- **Output**: `dist/` directory
- **Deployment**: Google Cloud Run with Docker + Nginx

### Local Storage Keys
All keys follow pattern: `tms_{tenantId}_{dataType}`
- If no tenant: `tms_{dataType}`

### Auto-Seeding
- Runs automatically when TMSContext initializes
- Only seeds if no data exists for tenant
- Brokers: 200+ records
- Factoring Companies: 50 records

---

## Summary

This TMS system is built on these core principles:

1. **Revenue Recognition**: Based on delivery date, not settlement creation
2. **Driver Pay Accuracy**: Uses actual driver payment profiles, not assumptions
3. **Period Accuracy**: All reports filter by transaction dates, not record dates
4. **Multi-Tenant Isolation**: Complete data separation per tenant
5. **Auto-Calculations**: Factoring fees, driver pay, accessorials all calculated automatically
6. **User Experience**: Fast autocomplete, quick status changes, clear empty states
7. **Data Integrity**: Stored pay values on loads for accuracy, settlements as payment records

The system prioritizes **accuracy** and **user experience** while maintaining **data isolation** and **flexibility** for different business models (company drivers vs. owner operators).

