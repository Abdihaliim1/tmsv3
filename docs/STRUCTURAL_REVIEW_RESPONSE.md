# TMS Structural Review - Comprehensive Analysis

**Date**: 2025-01-27  
**Reviewer**: AI Assistant  
**Scope**: Complete system architecture, business logic, data integrity, and operational workflows

---

## 1. SINGLE SOURCE OF TRUTH (CRITICAL) ⚠️

### Current State: **PARTIALLY IMPLEMENTED WITH DUPLICATION**

#### What Exists:
- **React/TypeScript System** (`/src/`): Active production system
  - Core business logic in `src/services/utils.ts`:
    - `calculateCompanyRevenue()` - Revenue recognition logic
    - `calculateDistance()` - Distance calculation
    - `validatePayPercentage()` - Driver pay validation
  - Settlement calculations in `src/pages/Settlements.tsx`
  - Driver pay logic in `src/pages/Reports.tsx` and `src/pages/Dashboard.tsx`
  - Invoice generation in `src/pages/AccountReceivables.tsx` and `src/pages/Invoices.tsx`

- **Legacy HTML/JS System** (`/legacy/`): Inactive but contains duplicate logic
  - `legacy/loads.html` - Has settlement calculation logic
  - `legacy/invoices.html` - Has invoice generation logic
  - `legacy/settlements.html` - Has settlement math
  - `scripts/main.js` - Contains business logic

#### Problem: **DUPLICATION CONFIRMED**
- Business logic exists in BOTH React and legacy files
- Revenue recognition logic is scattered across multiple React components
- No single authoritative module for:
  - Settlement calculations
  - Invoice totals
  - Driver pay formulas
  - Owner-operator commission logic

#### Where Logic Currently Lives:
1. **Revenue Recognition**: 
   - `src/services/utils.ts` - `calculateCompanyRevenue()` ✅ (GOOD - centralized)
   - `src/pages/Reports.tsx` - Direct calculations in useMemo ❌ (DUPLICATED)
   - `src/pages/Dashboard.tsx` - Direct calculations in useMemo ❌ (DUPLICATED)

2. **Driver Pay Calculations**:
   - `src/pages/Settlements.tsx` - Settlement generation logic
   - `src/pages/Reports.tsx` - Profit breakdown calculations
   - `src/pages/Dashboard.tsx` - Driver pay calculations
   - **NO SINGLE SOURCE** - Logic duplicated in 3+ places

3. **Settlement Math**:
   - `src/pages/Settlements.tsx` - Main settlement creation
   - `src/services/settlementPDF.ts` - PDF generation (uses settlement data)
   - Logic is embedded in component, not extracted to service

4. **Invoice Totals**:
   - `src/pages/AccountReceivables.tsx` - Invoice creation
   - `src/pages/Invoices.tsx` - Invoice management
   - `src/context/TMSContext.tsx` - Auto-invoice on load delivery
   - Logic scattered across 3 files

#### Migration Plan:

**STEP 1: Create Centralized Business Logic Module**
- **File**: `src/services/businessLogic.ts`
- **Exports**:
  ```typescript
  // Revenue & Commission
  export function calculateCompanyRevenue(grossAmount: number, driver?: Driver): number
  export function calculateOwnerOperatorCommission(grossAmount: number, driverSplit: number): number
  
  // Driver Pay
  export function calculateDriverBasePay(load: Load, driver: Driver): number
  export function calculateDriverTotalPay(load: Load, driver: Driver): number
  export function calculateDriverPayByType(load: Load, driver: Driver): number
  
  // Settlement
  export function calculateSettlementGrossPay(loads: Load[], driver: Driver): number
  export function calculateSettlementDeductions(settlement: Settlement): number
  export function calculateSettlementNetPay(settlement: Settlement): number
  
  // Invoice
  export function calculateInvoiceTotal(loads: Load[]): number
  export function calculateInvoiceGrandTotal(invoice: Invoice): number
  
  // Reporting
  export function calculatePeriodRevenue(loads: Load[], period: DateRange): number
  export function calculatePeriodDriverPay(loads: Load[], settlements: Settlement[], period: DateRange): number
  export function calculatePeriodProfit(loads: Load[], expenses: Expense[], settlements: Settlement[], period: DateRange): number
  ```

**STEP 2: Refactor All Components**
- Replace inline calculations in `Reports.tsx`, `Dashboard.tsx`, `Settlements.tsx` with imports from `businessLogic.ts`
- Update `TMSContext.tsx` to use centralized functions
- Remove duplicate logic from legacy files (or mark as deprecated)

**STEP 3: Remove Legacy Code**
- Move `/legacy/` to `/legacy-archive/` or delete if React system is fully operational
- Update documentation to reference only React system

**Implementation Priority**: **CRITICAL** - Must be done before adding new features

---

## 2. WORKFLOW / TASK ENGINE (STATUS → ACTIONS) ❌

### Current State: **NOT IMPLEMENTED**

#### What's Missing:
- **No Task interface** in `src/types.ts`
- **No task creation** on load events
- **No task management UI**
- **No task dashboard**
- **No automated follow-ups**

#### Required Implementation:

**STEP 1: Data Model**
```typescript
// Add to src/types.ts
export interface Task {
  id: string;
  type: 'load_created' | 'load_dispatched' | 'load_delivered' | 'invoice_overdue' | 'pod_request' | 'rate_confirmation' | 'custom';
  entityType: 'load' | 'invoice' | 'settlement' | 'driver' | 'expense';
  entityId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string; // Employee ID
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  metadata?: Record<string, any>; // For task-specific data
}
```

**STEP 2: Task Creation Rules**
```typescript
// src/services/taskEngine.ts
export function createTasksForLoad(load: Load): Task[] {
  const tasks: Task[] = [];
  
  if (load.status === LoadStatus.Available) {
    tasks.push({
      type: 'load_created',
      entityType: 'load',
      entityId: load.id,
      title: `Assign driver to Load #${load.loadNumber}`,
      priority: 'high',
      status: 'pending'
    });
    tasks.push({
      type: 'rate_confirmation',
      entityType: 'load',
      entityId: load.id,
      title: `Send rate confirmation for Load #${load.loadNumber}`,
      priority: 'medium',
      status: 'pending'
    });
  }
  
  if (load.status === LoadStatus.Dispatched) {
    tasks.push({
      type: 'load_dispatched',
      entityType: 'load',
      entityId: load.id,
      title: `Confirm pickup for Load #${load.loadNumber}`,
      priority: 'high',
      status: 'pending',
      dueDate: load.pickupDate
    });
  }
  
  if (load.status === LoadStatus.Delivered) {
    tasks.push({
      type: 'pod_request',
      entityType: 'load',
      entityId: load.id,
      title: `Request POD for Load #${load.loadNumber}`,
      priority: 'high',
      status: 'pending'
    });
    tasks.push({
      type: 'invoice_customer',
      entityType: 'load',
      entityId: load.id,
      title: `Invoice customer for Load #${load.loadNumber}`,
      priority: 'medium',
      status: 'pending'
    });
  }
  
  return tasks;
}

export function createTasksForInvoice(invoice: Invoice): Task[] {
  const tasks: Task[] = [];
  
  if (invoice.status === 'overdue') {
    tasks.push({
      type: 'invoice_overdue',
      entityType: 'invoice',
      entityId: invoice.id,
      title: `Follow up on overdue Invoice ${invoice.invoiceNumber}`,
      priority: 'urgent',
      status: 'pending',
      dueDate: invoice.dueDate
    });
  }
  
  return tasks;
}
```

**STEP 3: Task Management UI**
- Create `src/pages/Tasks.tsx` - Task dashboard
- Add task list to `src/pages/Dashboard.tsx` - Show pending tasks
- Add task creation hooks in `src/context/TMSContext.tsx`
- Auto-create tasks on load status changes

**STEP 4: Integration Points**
- `src/components/AddLoadModal.tsx` - Create tasks on load creation
- `src/pages/Loads.tsx` - Create tasks on status change
- `src/pages/AccountReceivables.tsx` - Create tasks for overdue invoices
- `src/pages/Settlements.tsx` - Create tasks for POD requests

**Implementation Priority**: **HIGH** - Critical for operational efficiency

---

## 3. DOCUMENT MANAGEMENT (NON-NEGOTIABLE) ⚠️

### Current State: **PARTIALLY IMPLEMENTED**

#### What Exists:
- **Document Number Fields** in `Load` interface:
  - `bolNumber?: string` - Bill of Lading number
  - `poNumber?: string` - Purchase Order number
  - `podNumber?: string` - Proof of Delivery number
- **No Document Attachment System**
- **No Document Validation**
- **No Document Storage**

#### What's Missing:
- Document files cannot be uploaded/attached
- No validation that POD is required before invoicing
- No validation that BOL is required before dispatch
- No "missing documents" state
- No document storage mechanism

#### Required Implementation:

**STEP 1: Document Data Model**
```typescript
// Add to src/types.ts
export interface Document {
  id: string;
  type: 'bol' | 'pod' | 'rate_confirmation' | 'lumper_receipt' | 'invoice' | 'settlement' | 'other';
  entityType: 'load' | 'invoice' | 'settlement' | 'expense';
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl?: string; // URL to stored file (localStorage key or cloud storage)
  uploadedAt: string;
  uploadedBy?: string;
  isRequired: boolean;
  status: 'missing' | 'uploaded' | 'verified';
  metadata?: Record<string, any>;
}

// Update Load interface
export interface Load {
  // ... existing fields
  documents?: Document[]; // Array of document IDs or full documents
  requiredDocuments?: string[]; // Array of required document types
  hasBOL?: boolean; // Computed: documents.some(d => d.type === 'bol')
  hasPOD?: boolean; // Computed: documents.some(d => d.type === 'pod')
}
```

**STEP 2: Document Storage**
- **Option A**: Store file data in localStorage (base64 encoded, limited size)
- **Option B**: Integrate cloud storage (Firebase Storage, AWS S3, Google Cloud Storage)
- **Recommendation**: Start with localStorage for MVP, migrate to cloud storage later

**STEP 3: Document Validation Rules**
```typescript
// src/services/documentValidation.ts
export function canInvoiceLoad(load: Load): { canInvoice: boolean; missingDocs: string[] } {
  const required = ['pod']; // POD required for invoicing
  const missing: string[] = [];
  
  if (!load.hasPOD && !load.documents?.some(d => d.type === 'pod')) {
    missing.push('pod');
  }
  
  return {
    canInvoice: missing.length === 0,
    missingDocs: missing
  };
}

export function canDispatchLoad(load: Load): { canDispatch: boolean; missingDocs: string[] } {
  const required = ['bol', 'rate_confirmation'];
  const missing: string[] = [];
  
  if (!load.hasBOL && !load.documents?.some(d => d.type === 'bol')) {
    missing.push('bol');
  }
  
  // Check for rate confirmation
  if (!load.documents?.some(d => d.type === 'rate_confirmation')) {
    missing.push('rate_confirmation');
  }
  
  return {
    canDispatch: missing.length === 0,
    missingDocs: missing
  };
}
```

**STEP 4: UI Integration**
- Add document upload component to `src/components/AddLoadModal.tsx`
- Add document list to load detail view
- Block invoice creation if POD is missing
- Block dispatch if BOL is missing
- Show "Missing Documents" warning in load list

**STEP 5: Document Management Page**
- Create `src/pages/Documents.tsx` - Document management
- Filter by type, entity, status
- Bulk upload/download

**Implementation Priority**: **HIGH** - Required for compliance and operations

---

## 4. INVOICES, AR, AND PAYMENTS ⚠️

### Current State: **PARTIALLY IMPLEMENTED WITH CRITICAL ISSUES**

#### What Exists:
- **Invoice Generation**: Auto-creates invoices for delivered loads
- **Invoice Status**: `pending`, `paid`, `overdue`, `draft`
- **Payment Tracking**: `paidAmount` field exists in `Invoice` interface
- **Overdue Detection**: Automatically marks invoices as overdue

#### Critical Issues:

**ISSUE 1: Invoice Number Generation - NOT GLOBALLY UNIQUE**
```typescript
// CURRENT (WRONG):
invoiceNumber: `INV-${new Date().getFullYear()}-${invoices.length + 1001}`
```
- **Problem**: Uses array length, which can cause collisions if invoices are deleted
- **Problem**: Not tenant-aware (if multi-tenant, could have duplicates)
- **Problem**: Not sequential if invoices are created out of order

**Location**: 
- `src/pages/AccountReceivables.tsx:101`
- `src/pages/Invoices.tsx:81`
- `src/context/TMSContext.tsx:263,424`

**Fix Required**:
```typescript
// src/services/invoiceService.ts
export function generateUniqueInvoiceNumber(
  year: number, 
  existingInvoices: Invoice[], 
  tenantId?: string
): string {
  // Get all invoice numbers for this year
  const yearInvoices = existingInvoices.filter(inv => {
    const invYear = new Date(inv.date).getFullYear();
    return invYear === year;
  });
  
  // Extract highest sequence number
  const pattern = new RegExp(`^INV-${year}-(\\d+)$`);
  let maxSeq = 1000;
  
  yearInvoices.forEach(inv => {
    const match = inv.invoiceNumber.match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });
  
  // Return next sequential number
  return `INV-${year}-${maxSeq + 1}`;
}
```

**ISSUE 2: Partial Payments - IMPLEMENTED BUT INCOMPLETE**
- ✅ `paidAmount` field exists
- ❌ No validation that `paidAmount <= amount`
- ❌ No automatic status transition (`pending` → `partial` → `paid`)
- ❌ No payment history (only single `paidAmount` field)

**Fix Required**:
```typescript
// Update Invoice interface
export interface Invoice {
  // ... existing fields
  paidAmount?: number; // Total paid (sum of payments)
  payments?: Payment[]; // Payment history
  status: InvoiceStatus; // Should auto-update based on paidAmount
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: 'ACH' | 'Check' | 'Wire' | 'Credit' | 'Other';
  reference?: string;
  notes?: string;
  createdAt: string;
}

// Payment validation
export function validatePayment(invoice: Invoice, paymentAmount: number): {
  valid: boolean;
  error?: string;
} {
  const currentPaid = invoice.paidAmount || 0;
  const total = invoice.amount;
  const newTotal = currentPaid + paymentAmount;
  
  if (paymentAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than 0' };
  }
  
  if (newTotal > total * 1.01) { // 1% tolerance for rounding
    return { valid: false, error: `Payment exceeds invoice amount. Maximum: $${(total - currentPaid).toFixed(2)}` };
  }
  
  return { valid: true };
}

// Auto-update invoice status
export function updateInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const paid = invoice.paidAmount || 0;
  const total = invoice.amount;
  
  if (paid >= total * 0.99) { // 99% threshold for "paid"
    return 'paid';
  } else if (paid > 0) {
    return 'partial';
  } else {
    // Check if overdue
    if (invoice.dueDate) {
      const due = new Date(invoice.dueDate);
      const today = new Date();
      if (due < today) return 'overdue';
    }
    return 'pending';
  }
}
```

**ISSUE 3: AR Aging - NOT IMPLEMENTED**
- No aging buckets (0-30, 31-60, 61-90, 90+)
- No aging report
- No aging calculation

**Fix Required**:
```typescript
// src/services/arAging.ts
export interface AgingBucket {
  current: number;    // 0-30 days
  days31_60: number;  // 31-60 days
  days61_90: number;  // 61-90 days
  days90Plus: number; // 90+ days
  total: number;
}

export function calculateAging(invoice: Invoice, asOfDate: Date = new Date()): AgingBucket {
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (!dueDate) {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
  }
  
  const daysPastDue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  const outstanding = invoice.amount - (invoice.paidAmount || 0);
  
  if (outstanding <= 0) {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
  }
  
  if (daysPastDue <= 0) {
    return { current: outstanding, days31_60: 0, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 30) {
    return { current: outstanding, days31_60: 0, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 60) {
    return { current: 0, days31_60: outstanding, days61_90: 0, days90Plus: 0, total: outstanding };
  } else if (daysPastDue <= 90) {
    return { current: 0, days31_60: 0, days61_90: outstanding, days90Plus: 0, total: outstanding };
  } else {
    return { current: 0, days31_60: 0, days61_90: 0, days90Plus: outstanding, total: outstanding };
  }
}
```

**ISSUE 4: Credit Memos - NOT IMPLEMENTED**
- No credit memo system
- No adjustment invoices
- No refund tracking

**Implementation Priority**: **CRITICAL** - Invoice numbering must be fixed immediately

---

## 5. IFTA (REAL, NOT UI-ONLY) ❌

### Current State: **NOT IMPLEMENTED - UI PLACEHOLDER ONLY**

#### What Exists:
- `legacy/ifta.html` - UI placeholder with mock data
- No data model for IFTA
- No state miles tracking
- No fuel purchase tracking
- No IFTA report generation

#### What's Missing:
- **State Miles Tracking**: No storage of miles per state per trip
- **Fuel Purchase Tracking**: No gallons + state storage
- **IFTA Report Generation**: No real calculations
- **MPG Calculation**: No fuel efficiency tracking
- **Tax Due/Credit**: No tax calculation per state

#### Required Implementation:

**STEP 1: Data Model**
```typescript
// Add to src/types.ts
export interface IFTAStateMiles {
  id: string;
  loadId: string;
  state: string; // State code (e.g., "OH", "IL")
  miles: number;
  date: string; // Trip date
  truckId?: string;
  driverId?: string;
}

export interface IFTAFuelPurchase {
  id: string;
  date: string;
  state: string; // State where fuel was purchased
  gallons: number;
  cost: number;
  truckId?: string;
  driverId?: string;
  vendor?: string;
  receiptNumber?: string;
  odometerReading?: number;
}

export interface IFTAReport {
  id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  stateMiles: Record<string, number>; // State code -> total miles
  fuelPurchases: Record<string, { gallons: number; cost: number }>; // State code -> fuel data
  mpg: number; // Overall MPG
  taxDue: Record<string, number>; // State code -> tax due/credit
  status: 'draft' | 'filed' | 'paid';
  filedDate?: string;
  createdAt: string;
  updatedAt: string;
}
```

**STEP 2: State Miles Tracking**
- Update `Load` interface to include state-by-state miles
- Add state miles input to `AddLoadModal.tsx`
- Auto-calculate state miles from route (if possible) or manual entry
- Store in `IFTAStateMiles` collection

**STEP 3: Fuel Purchase Tracking**
- Create `src/pages/IFTAFuel.tsx` - Fuel purchase entry
- Link to expenses (fuel expenses should feed IFTA)
- Store in `IFTAFuelPurchase` collection

**STEP 4: IFTA Report Generation**
```typescript
// src/services/iftaService.ts
export function generateIFTAReport(
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  year: number,
  stateMiles: IFTAStateMiles[],
  fuelPurchases: IFTAFuelPurchase[]
): IFTAReport {
  // Filter to quarter
  const quarterStart = getQuarterStart(quarter, year);
  const quarterEnd = getQuarterEnd(quarter, year);
  
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
  const mpg = totalMiles / totalGallons;
  
  // Calculate tax due per state (simplified - actual IFTA calculation is more complex)
  const taxDue: Record<string, number> = {};
  Object.keys(milesByState).forEach(state => {
    // This is a placeholder - actual IFTA tax calculation requires state tax rates
    const stateMiles = milesByState[state];
    const stateFuel = fuelByState[state]?.gallons || 0;
    const stateMPG = stateMiles / stateFuel;
    // Tax calculation would go here based on state rates
    taxDue[state] = 0; // Placeholder
  });
  
  return {
    id: generateId(),
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
```

**STEP 5: IFTA UI**
- Create `src/pages/IFTA.tsx` - IFTA dashboard
- Show state miles, fuel purchases, reports
- Generate quarterly reports
- Export to CSV/PDF

**Implementation Priority**: **MEDIUM** - Important for compliance, but can be added incrementally

---

## 6. ACCOUNTING STRUCTURE (LIGHT BUT CORRECT) ⚠️

### Current State: **PARTIALLY IMPLEMENTED**

#### What Exists:
- **Expense Types**: Defined in `Expense` interface
  ```typescript
  type: 'fuel' | 'maintenance' | 'insurance' | 'toll' | 'lumper' | 'permit' | 'lodging' | 'other'
  ```
- **Expense Status**: `pending` | `approved` | `rejected`
- **Expense Linking**: Can link to `loadId`, `driverId`, `truckId`

#### What's Missing:
- **No Chart of Accounts Structure**: Types are flat, no hierarchy
- **No Account Codes**: No numbering system (e.g., 4000-Fuel, 5000-Maintenance)
- **No Category Grouping**: No logical grouping (Operating Expenses, Administrative, etc.)
- **No Expense Approval Workflow**: Status exists but no workflow
- **No Cleared State**: No reconciliation tracking

#### Required Implementation:

**STEP 1: Chart of Accounts Structure**
```typescript
// Add to src/types.ts
export interface ChartOfAccounts {
  id: string;
  code: string; // e.g., "4000", "4100"
  name: string; // e.g., "Fuel", "Maintenance"
  category: 'revenue' | 'operating_expense' | 'administrative' | 'driver_pay' | 'other';
  parentCode?: string; // For sub-accounts
  isActive: boolean;
}

// Update Expense interface
export interface Expense {
  // ... existing fields
  accountCode?: string; // Link to Chart of Accounts
  category?: ExpenseCategory; // Keep for backward compatibility
  isCleared?: boolean; // Reconciliation flag
  clearedDate?: string;
  clearedBy?: string;
}

export type ExpenseCategory = 
  | 'fuel'           // 4000 - Operating Expenses
  | 'maintenance'    // 4100 - Operating Expenses
  | 'insurance'      // 4200 - Operating Expenses
  | 'toll'           // 4300 - Operating Expenses
  | 'lumper'         // 4400 - Operating Expenses
  | 'permit'         // 4500 - Operating Expenses
  | 'lodging'        // 4600 - Operating Expenses
  | 'factoring_fee'  // 4700 - Operating Expenses
  | 'office'         // 5000 - Administrative
  | 'other';         // 9000 - Other
```

**STEP 2: Default Chart of Accounts**
```typescript
// src/services/chartOfAccounts.ts
export const DEFAULT_CHART_OF_ACCOUNTS: ChartOfAccounts[] = [
  // Revenue
  { id: '1', code: '1000', name: 'Gross Revenue', category: 'revenue', isActive: true },
  { id: '2', code: '1100', name: 'Factored Revenue', category: 'revenue', isActive: true },
  
  // Operating Expenses
  { id: '3', code: '4000', name: 'Fuel', category: 'operating_expense', isActive: true },
  { id: '4', code: '4100', name: 'Maintenance & Repairs', category: 'operating_expense', isActive: true },
  { id: '5', code: '4200', name: 'Insurance', category: 'operating_expense', isActive: true },
  { id: '6', code: '4300', name: 'Tolls', category: 'operating_expense', isActive: true },
  { id: '7', code: '4400', name: 'Lumper Fees', category: 'operating_expense', isActive: true },
  { id: '8', code: '4500', name: 'Permits & Licenses', category: 'operating_expense', isActive: true },
  { id: '9', code: '4600', name: 'Lodging', category: 'operating_expense', isActive: true },
  { id: '10', code: '4700', name: 'Factoring Fees', category: 'operating_expense', isActive: true },
  
  // Driver Pay
  { id: '11', code: '3000', name: 'Driver Pay - Company Drivers', category: 'driver_pay', isActive: true },
  { id: '12', code: '3100', name: 'Driver Pay - Owner Operators', category: 'driver_pay', isActive: true },
  
  // Administrative
  { id: '13', code: '5000', name: 'Office & Administrative', category: 'administrative', isActive: true },
  
  // Other
  { id: '14', code: '9000', name: 'Other Expenses', category: 'other', isActive: true },
];
```

**STEP 3: Expense Approval Workflow**
- Add approval workflow to `src/pages/Expenses.tsx`
- Require approval for expenses over threshold
- Track approval history
- Email notifications (future)

**STEP 4: Reporting by Account**
- Update `src/pages/Reports.tsx` to group expenses by Chart of Accounts
- Show P&L by account category
- Export financial statements

**Implementation Priority**: **MEDIUM** - Improves reporting but not critical for operations

---

## 7. DATA INTEGRITY RULES ⚠️

### Current State: **PARTIALLY IMPLEMENTED**

#### What Exists:
- **Basic Validation**: In `scripts/data-stability.js`
  - Load number required
  - Driver name required
  - Rate validation
- **Some Business Rules**: 
  - Load delivery date validation (implicit in UI)
  - Invoice amount validation (implicit)

#### What's Missing:
- **No Comprehensive Validation Layer**: Validation scattered, not centralized
- **No Adjustment Tracking**: Edits to delivered loads don't create adjustments
- **No Payment Validation**: Payments can exceed invoice amount
- **No Cascade Protection**: Deleting records can corrupt settlements/invoices

#### Required Implementation:

**STEP 1: Centralized Validation Service**
```typescript
// src/services/validation.ts
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateLoad(load: Load | NewLoadInput): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!load.loadNumber) {
    errors.push(new ValidationError('loadNumber', 'Load number is required'));
  }
  
  if (!load.rate || load.rate <= 0) {
    errors.push(new ValidationError('rate', 'Load rate must be greater than 0'));
  }
  
  if (load.status === LoadStatus.Delivered && !load.deliveryDate) {
    errors.push(new ValidationError('deliveryDate', 'Delivery date is required for delivered loads'));
  }
  
  if (load.status === LoadStatus.Delivered && !load.driverId) {
    errors.push(new ValidationError('driverId', 'Driver is required for delivered loads'));
  }
  
  return errors;
}

export function validateInvoice(invoice: Invoice | Omit<Invoice, 'id'>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!invoice.invoiceNumber) {
    errors.push(new ValidationError('invoiceNumber', 'Invoice number is required'));
  }
  
  if (!invoice.amount || invoice.amount <= 0) {
    errors.push(new ValidationError('amount', 'Invoice amount must be greater than 0'));
  }
  
  if (invoice.paidAmount && invoice.paidAmount > invoice.amount * 1.01) {
    errors.push(new ValidationError('paidAmount', `Payment exceeds invoice amount. Maximum: $${invoice.amount.toFixed(2)}`));
  }
  
  return errors;
}

export function validatePayment(invoice: Invoice, paymentAmount: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (paymentAmount <= 0) {
    errors.push(new ValidationError('paymentAmount', 'Payment amount must be greater than 0'));
  }
  
  const currentPaid = invoice.paidAmount || 0;
  const total = invoice.amount;
  const newTotal = currentPaid + paymentAmount;
  
  if (newTotal > total * 1.01) { // 1% tolerance
    errors.push(new ValidationError('paymentAmount', `Payment would exceed invoice amount. Remaining: $${(total - currentPaid).toFixed(2)}`));
  }
  
  return errors;
}
```

**STEP 2: Adjustment Tracking**
```typescript
// Add to src/types.ts
export interface Adjustment {
  id: string;
  entityType: 'load' | 'invoice' | 'settlement';
  entityId: string;
  type: 'correction' | 'credit' | 'debit' | 'refund';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// When editing a delivered load, create adjustment
export function createLoadAdjustment(
  originalLoad: Load,
  updatedLoad: Load,
  userId: string
): Adjustment | null {
  // Check if financial fields changed
  const rateChanged = originalLoad.rate !== updatedLoad.rate;
  const driverPayChanged = originalLoad.driverTotalGross !== updatedLoad.driverTotalGross;
  
  if (!rateChanged && !driverPayChanged) {
    return null; // No adjustment needed
  }
  
  const amount = (updatedLoad.rate || 0) - (originalLoad.rate || 0);
  
  return {
    id: generateId(),
    entityType: 'load',
    entityId: updatedLoad.id,
    type: amount > 0 ? 'debit' : 'credit',
    amount: Math.abs(amount),
    reason: `Load ${updatedLoad.loadNumber} rate adjusted from $${originalLoad.rate} to $${updatedLoad.rate}`,
    createdBy: userId,
    createdAt: new Date().toISOString()
  };
}
```

**STEP 3: Cascade Protection**
```typescript
// src/services/cascadeProtection.ts
export function canDeleteLoad(load: Load, invoices: Invoice[], settlements: Settlement[]): {
  canDelete: boolean;
  reason?: string;
  linkedEntities: string[];
} {
  const linked: string[] = [];
  
  // Check if linked to invoice
  const linkedInvoice = invoices.find(inv => inv.loadIds?.includes(load.id));
  if (linkedInvoice) {
    linked.push(`Invoice ${linkedInvoice.invoiceNumber}`);
  }
  
  // Check if linked to settlement
  const linkedSettlement = settlements.find(s => s.loadIds?.includes(load.id));
  if (linkedSettlement) {
    linked.push(`Settlement ${linkedSettlement.settlementNumber}`);
  }
  
  if (linked.length > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete load. It is linked to: ${linked.join(', ')}`,
      linkedEntities: linked
    };
  }
  
  return { canDelete: true, linkedEntities: [] };
}

export function canDeleteInvoice(invoice: Invoice, loads: Load[]): {
  canDelete: boolean;
  reason?: string;
} {
  // Check if invoice has payments
  if (invoice.paidAmount && invoice.paidAmount > 0) {
    return {
      canDelete: false,
      reason: 'Cannot delete invoice with payments. Create credit memo instead.'
    };
  }
  
  return { canDelete: true };
}
```

**STEP 4: Integration**
- Add validation to all create/update functions in `TMSContext.tsx`
- Show validation errors in UI
- Block destructive operations with linked entities
- Create adjustments automatically on edits

**Implementation Priority**: **HIGH** - Critical for data integrity

---

## 8. ADMIN / DESTRUCTIVE TOOLS SAFETY ❌

### Current State: **NOT PROTECTED**

#### What Exists:
- `legacy/clear-database.html` - Database clearing tool
- No authentication check
- No confirmation beyond checkbox
- No backup before delete
- No production check

#### What's Missing:
- **No Production Protection**: Tool can run in production
- **No Re-Authentication**: No password confirmation
- **No Backup**: No automatic backup before delete
- **No Super-Admin Check**: No role-based access
- **No Audit Log**: No record of who deleted what

#### Required Implementation:

**STEP 1: Production Check**
```typescript
// src/services/adminSafety.ts
export function isProduction(): boolean {
  // Check environment variable or config
  return import.meta.env.PROD === true || 
         window.location.hostname !== 'localhost' &&
         !window.location.hostname.includes('dev') &&
         !window.location.hostname.includes('staging');
}

export function requireProductionCheck(): boolean {
  if (isProduction()) {
    const confirmed = window.confirm(
      '⚠️ PRODUCTION ENVIRONMENT DETECTED ⚠️\n\n' +
      'You are about to perform a destructive operation in PRODUCTION.\n\n' +
      'This action cannot be undone.\n\n' +
      'Type "DELETE PRODUCTION DATA" to confirm:'
    );
    
    if (!confirmed) return false;
    
    // Require typed confirmation
    const typed = window.prompt('Type "DELETE PRODUCTION DATA" to confirm:');
    if (typed !== 'DELETE PRODUCTION DATA') {
      alert('Confirmation text does not match. Operation cancelled.');
      return false;
    }
    
    return true;
  }
  
  return true; // Allow in dev/staging
}
```

**STEP 2: Backup Before Delete**
```typescript
// src/services/backupService.ts
export async function createBackupBeforeDelete(): Promise<string | null> {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      loads: loadFromStorage('loads', []),
      drivers: loadFromStorage('drivers', []),
      invoices: loadFromStorage('invoices', []),
      settlements: loadFromStorage('settlements', []),
      expenses: loadFromStorage('expenses', []),
      // ... all collections
    };
    
    const backupJson = JSON.stringify(backup, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Auto-download backup
    const link = document.createElement('a');
    link.href = url;
    link.download = `tms-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    // Also store in localStorage as backup
    localStorage.setItem('last_backup', backupJson);
    
    return url;
  } catch (error) {
    console.error('Backup failed:', error);
    return null;
  }
}
```

**STEP 3: Admin Authentication**
```typescript
// src/services/adminAuth.ts
export function requireAdminAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    const password = window.prompt('Enter admin password to continue:');
    
    // In production, this should check against secure backend
    // For now, use environment variable or config
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'ADMIN_PASSWORD_CHANGE_ME';
    
    if (password === adminPassword) {
      resolve(true);
    } else {
      alert('Invalid admin password. Operation cancelled.');
      resolve(false);
    }
  });
}
```

**STEP 4: Audit Logging**
```typescript
// src/services/auditLog.ts
export interface AuditLog {
  id: string;
  action: 'delete' | 'clear' | 'export' | 'import' | 'modify';
  entityType: string;
  entityId?: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: Record<string, any>;
  ipAddress?: string;
}

export function logAdminAction(
  action: AuditLog['action'],
  entityType: string,
  details: Record<string, any>
): void {
  const log: AuditLog = {
    id: generateId(),
    action,
    entityType,
    userId: getCurrentUserId(),
    userName: getCurrentUserName(),
    timestamp: new Date().toISOString(),
    details,
    ipAddress: 'client' // Would get from server in production
  };
  
  // Store in localStorage (in production, send to server)
  const logs = loadFromStorage('audit_logs', []);
  logs.push(log);
  saveToStorage('audit_logs', logs.slice(-1000)); // Keep last 1000 logs
}
```

**STEP 5: Protected Admin UI**
- Create `src/pages/Admin.tsx` - Protected admin panel
- Require authentication to access
- Show backup/download option
- Log all actions
- Disable in production by default (require feature flag)

**Implementation Priority**: **CRITICAL** - Must be implemented before production use

---

## 9. FINAL CONFIRMATION

### Summary of Issues

#### ✅ **Issues Already Fixed:**
1. **Driver Pay Calculation** - Uses driver profile rates (fixed in Reports.tsx, Dashboard.tsx)
2. **Period-Based P&L** - Filters by transaction dates, not settlement creation dates
3. **Owner-Operator Revenue** - Uses `calculateCompanyRevenue()` for commission-only revenue
4. **Multi-Tenant Isolation** - Tenant-aware data storage implemented
5. **Factoring Fee Calculation** - Auto-calculates from percentage
6. **Broker Autocomplete** - Prefix-based search implemented
7. **Factoring Company Autocomplete** - Similar system implemented

#### ⚠️ **Issues Partially Implemented:**
1. **Single Source of Truth** - Core functions exist but logic duplicated across components
2. **Document Management** - Fields exist but no attachment system or validation
3. **Invoice/AR/Payments** - Basic structure exists but missing:
   - Globally unique invoice numbers
   - Payment history
   - AR aging
   - Credit memos
4. **Accounting Structure** - Expense types exist but no Chart of Accounts
5. **Data Integrity** - Basic validation exists but not comprehensive

#### ❌ **Missing Features:**
1. **Workflow/Task Engine** - Completely missing
2. **IFTA System** - Only UI placeholder, no real implementation
3. **Admin Safety** - No protection for destructive operations

---

### Step-by-Step Action Plan (Priority Order)

#### **PHASE 1: CRITICAL FIXES (Week 1)**
1. **Fix Invoice Number Generation** ⚠️ **CRITICAL**
   - Create `src/services/invoiceService.ts`
   - Implement `generateUniqueInvoiceNumber()`
   - Update all invoice creation points
   - **Files**: `AccountReceivables.tsx`, `Invoices.tsx`, `TMSContext.tsx`

2. **Implement Admin Safety** ⚠️ **CRITICAL**
   - Create `src/services/adminSafety.ts`
   - Add production check
   - Add backup before delete
   - Add admin authentication
   - Add audit logging
   - **Files**: New admin service, update any delete/clear functions

3. **Centralize Business Logic** ⚠️ **HIGH**
   - Create `src/services/businessLogic.ts`
   - Extract all calculation logic from components
   - Refactor `Reports.tsx`, `Dashboard.tsx`, `Settlements.tsx`
   - **Files**: New service, update 3+ components

#### **PHASE 2: HIGH PRIORITY (Week 2-3)**
4. **Implement Data Integrity Rules** ⚠️ **HIGH**
   - Create `src/services/validation.ts`
   - Create `src/services/cascadeProtection.ts`
   - Add validation to all create/update operations
   - Add adjustment tracking
   - **Files**: New services, update `TMSContext.tsx`

5. **Implement Document Management** ⚠️ **HIGH**
   - Add `Document` interface to `types.ts`
   - Create document storage (localStorage for MVP)
   - Add document validation rules
   - Update `AddLoadModal.tsx` with document upload
   - Block invoicing without POD
   - **Files**: `types.ts`, new `documentService.ts`, update modals

6. **Enhance Invoice/AR System** ⚠️ **HIGH**
   - Add `Payment` interface
   - Implement payment history
   - Add AR aging calculation
   - Add credit memo system
   - **Files**: `types.ts`, `arAging.ts`, update `AccountReceivables.tsx`

#### **PHASE 3: MEDIUM PRIORITY (Week 4-5)**
7. **Implement Task Engine** ⚠️ **MEDIUM**
   - Add `Task` interface to `types.ts`
   - Create `src/services/taskEngine.ts`
   - Create `src/pages/Tasks.tsx`
   - Auto-create tasks on load events
   - **Files**: `types.ts`, new service, new page, update load components

8. **Implement Chart of Accounts** ⚠️ **MEDIUM**
   - Add `ChartOfAccounts` interface
   - Create default chart
   - Update expense categorization
   - Update reporting
   - **Files**: `types.ts`, `chartOfAccounts.ts`, update `Expenses.tsx`, `Reports.tsx`

9. **Implement IFTA System** ⚠️ **MEDIUM**
   - Add IFTA interfaces to `types.ts`
   - Create state miles tracking
   - Create fuel purchase tracking
   - Create IFTA report generation
   - Create `src/pages/IFTA.tsx`
   - **Files**: `types.ts`, `iftaService.ts`, new page

#### **PHASE 4: CLEANUP (Week 6)**
10. **Remove Legacy Code**
    - Archive or delete `/legacy/` folder
    - Remove duplicate logic
    - Update documentation
    - **Files**: Legacy folder, documentation

---

### Implementation Notes

1. **All new services should be in `src/services/`**
2. **All new types should be added to `src/types.ts`**
3. **All validation should be centralized in `src/services/validation.ts`**
4. **All business logic should be in `src/services/businessLogic.ts`**
5. **Test each phase before moving to next**
6. **Update `CORE_VALUES_AND_LOGIC.md` as features are added**

---

**END OF REVIEW**


