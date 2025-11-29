# Complete Chain of Effects: Load Booked by Dispatcher Ali

## 📋 SCENARIO: Dispatcher Ali Books a Load

**Load Details:**
- **Load #**: LD-2025-100
- **Route**: Columbus, OH → Chicago, IL
- **Total Rate**: $3,000
- **Miles**: 355
- **Dispatcher**: Ali (Commission: 5% percentage)
- **Driver**: John Doe (Owner Operator, 88% split)
- **Status Flow**: Available → In Transit → Delivered

---

## 🔗 STEP 1: LOAD BOOKING (Dispatcher Ali)

### What Happens When Load is Created:

```typescript
// Location: src/components/AddLoadModal.tsx
// When form is submitted, addLoad() is called
```

**1.1 Dispatcher Commission Calculation:**
```typescript
// Commission Type: percentage
// Commission Rate: 5%
// Total Rate: $3,000

dispatcherCommissionAmount = totalRate * (commissionRate / 100)
dispatcherCommissionAmount = $3,000 * (5 / 100)
dispatcherCommissionAmount = $150
```

**Result:**
- Dispatcher Ali earns **$150 commission** on this load
- This is stored in `load.dispatcherCommissionAmount`
- Commission is **NOT deducted from driver pay** - it's a company expense

**1.2 Load Data Stored:**
```json
{
  "id": "load-123",
  "loadNumber": "LD-2025-100",
  "rate": 3000,
  "miles": 355,
  "dispatcherId": "ali-id",
  "dispatcherName": "Ali",
  "dispatcherCommissionType": "percentage",
  "dispatcherCommissionRate": 5,
  "dispatcherCommissionAmount": 150,
  "driverId": "john-doe-id",
  "driverName": "John Doe",
  "status": "available"
}
```

---

## 💰 STEP 2: PAY CALCULATION (Driver John Doe)

### 2.1 Company Revenue Calculation

**Location:** `src/services/utils.ts` - `calculateCompanyRevenue()`

```typescript
// Driver Type: OwnerOperator
// Driver Split: 88% (0.88)
// Total Rate: $3,000

// Company Commission = 1 - Driver Split
companyCommission = 1 - 0.88 = 0.12 (12%)

// Company Revenue = Total Rate × Company Commission
companyRevenue = $3,000 × 0.12 = $360
```

**Result:**
- **Company Revenue**: $360 (12% commission)
- **Driver Gross Pay**: $2,640 (88% of $3,000)
- **Note**: This is calculated when load status changes to "delivered"

### 2.2 Driver Pay Calculation (For Settlement)

**Location:** `src/pages/Settlements.tsx` - `settlementTotals` useMemo

```typescript
// When generating settlement for John Doe:

// Step 1: Calculate Gross Pay
driverPayPercentage = validatePayPercentage(88, 'OwnerOperator') = 0.88
grossPay = load.rate * driverPayPercentage
grossPay = $3,000 * 0.88 = $2,640

// Step 2: Calculate Deductions
// (Based on driver's deduction preferences)
// If fuel deduction enabled and expense paidBy = 'company':
fuelDeduction = $400  // Example fuel expense
otherDeduction = $50  // Example other expenses
totalDeductions = $450

// Step 3: Calculate Net Pay
netPay = grossPay - totalDeductions
netPay = $2,640 - $450 = $2,190
```

**Result:**
- **Gross Pay**: $2,640
- **Deductions**: $450
- **Net Pay**: $2,190 (what driver actually receives)

---

## 💸 STEP 3: EXPENSES

### 3.1 Expense Types and Who Pays

**Location:** `src/types.ts` - `Expense` interface

**Expense Categories:**
- Fuel
- Maintenance
- Insurance
- Tolls
- Lumper Fees
- Permits
- Lodging
- Other

**Paid By Options:**
- `company` - Company pays (may be deducted from O/O settlement)
- `owner_operator` - Driver pays (not deducted)
- `tracked_only` - Just tracked, no payment

### 3.2 Expense Flow Example

**Scenario:** Fuel expense for this load

```json
{
  "id": "exp-456",
  "loadId": "load-123",
  "driverId": "john-doe-id",
  "truckId": "truck-789",
  "type": "fuel",
  "amount": 400,
  "paidBy": "company",  // Company paid for fuel
  "date": "2025-01-15"
}
```

**Impact on Settlement:**
- If John Doe has `deductionPreferences.fuel = true`:
  - Fuel expense **IS deducted** from his settlement
  - Net Pay = $2,640 - $400 = $2,240
- If `deductionPreferences.fuel = false`:
  - Fuel expense **NOT deducted**
  - Company absorbs the cost
  - Net Pay = $2,640 (no change)

**Impact on Company Profit:**
- Fuel expense **ALWAYS** reduces company profit
- Whether deducted from driver or not, it's a company cost

---

## 📊 STEP 4: SETTLEMENTS

### 4.1 Settlement Generation

**Location:** `src/pages/Settlements.tsx` - `handleGenerateSettlement()`

**When:** Weekly settlement generation for John Doe

**Process:**

```typescript
// Step 1: Select loads for the week
selectedLoads = [
  "load-123",  // Our load: $3,000
  "load-124",  // Another load: $2,000
  "load-125"   // Another load: $1,500
]

// Step 2: Calculate totals
totalRate = $3,000 + $2,000 + $1,500 = $6,500
grossPay = $6,500 * 0.88 = $5,720

// Step 3: Get expenses for the week
fuelExpenses = $400 + $300 + $200 = $900
otherExpenses = $50

// Step 4: Calculate deductions
totalDeductions = $900 + $50 = $950

// Step 5: Calculate net pay
netPay = $5,720 - $950 = $4,770
```

**Settlement Created:**
```json
{
  "id": "settlement-001",
  "driverId": "john-doe-id",
  "driverName": "John Doe",
  "loadIds": ["load-123", "load-124", "load-125"],
  "expenseIds": ["exp-456", "exp-457", "exp-458"],
  "grossPay": 5720,
  "totalDeductions": 950,
  "netPay": 4770,
  "status": "pending",
  "period": {
    "start": "2025-01-13",
    "end": "2025-01-19"
  }
}
```

**4.2 Load Marking:**
- After settlement is created, `load.settlementId` is set
- Load is marked as "settled" and won't appear in future settlements

---

## 📈 STEP 5: REPORTS

### 5.1 Revenue Reports

**Location:** `src/pages/Reports.tsx` - `calculateRealData()`

**Revenue Calculation:**
```typescript
// For Owner Operator loads:
loads.forEach(load => {
  if (load.status === 'delivered' || load.status === 'completed') {
    const driver = drivers.find(d => d.id === load.driverId);
    if (driver?.type === 'OwnerOperator') {
      // Company revenue = commission only
      revenue += calculateCompanyRevenue(load.rate, driver);
      // revenue += $3,000 * 0.12 = $360
    } else {
      // Company driver: full revenue
      revenue += load.rate;
    }
  }
});
```

**Result:**
- **Total Revenue** (for this load): $360
- **Total Load Amount**: $3,000 (shown separately)

### 5.2 Expense Reports

**Location:** `src/pages/Reports.tsx` - Expense calculations

```typescript
// Company-paid expenses
expenses.forEach(expense => {
  if (expense.paidBy === 'company') {
    totalExpenses += expense.amount;
    // Includes: fuel, insurance, maintenance, etc.
  }
});

// Dispatcher commissions (company expense)
loads.forEach(load => {
  if (load.dispatcherCommissionAmount) {
    totalExpenses += load.dispatcherCommissionAmount;
    // $150 for Dispatcher Ali's commission
  }
});
```

**Result:**
- **Total Expenses**: Includes all company-paid expenses + dispatcher commissions
- **Dispatcher Commission**: $150 (shown as company expense)

### 5.3 Profit Calculation

```typescript
// Net Profit = Revenue - Expenses - Driver Pay

// Revenue
revenue = $360  // Company commission from load

// Expenses
dispatcherCommission = $150
fuelExpense = $400  // If company paid
otherExpenses = $50
totalExpenses = $600

// Driver Pay (from settlements)
driverPay = $2,190  // Net pay from settlement

// Net Profit
netProfit = revenue - expenses - driverPay
netProfit = $360 - $600 - $2,190
netProfit = -$2,430  // Loss (in this example)
```

**Note:** This is simplified. In reality, profit is calculated across all loads, not per load.

### 5.4 Dispatcher Performance Reports

**Location:** Future feature (can be added to Reports page)

```typescript
// Track dispatcher performance
dispatchers.forEach(dispatcher => {
  const dispatcherLoads = loads.filter(l => l.dispatcherId === dispatcher.id);
  const totalRevenue = dispatcherLoads.reduce((sum, load) => {
    return sum + calculateCompanyRevenue(load.rate, getDriver(load.driverId));
  }, 0);
  const totalCommission = dispatcherLoads.reduce((sum, load) => {
    return sum + (load.dispatcherCommissionAmount || 0);
  }, 0);
  
  // Metrics:
  // - Total Loads Booked
  // - Total Revenue Generated
  // - Total Commission Earned
  // - Average Commission per Load
  // - Revenue per Load
});
```

---

## 🔄 COMPLETE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DISPATCHER ALI BOOKS LOAD                               │
│    - Load: $3,000, 355 miles                               │
│    - Dispatcher Commission: $150 (5%)                       │
│    - Driver: John Doe (Owner Operator, 88%)                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LOAD STATUS: Available → In Transit → Delivered        │
│    - When delivered, invoice auto-created                  │
│    - Load becomes available for settlement                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. COMPANY REVENUE CALCULATED                               │
│    - Company Revenue: $360 (12% commission)                │
│    - Driver Gross Pay: $2,640 (88% of $3,000)              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EXPENSES RECORDED                                        │
│    - Fuel: $400 (paidBy: company)                           │
│    - If driver has fuel deduction enabled:                 │
│      → Deducted from settlement                             │
│    - If not: Company absorbs cost                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SETTLEMENT GENERATED (Weekly)                            │
│    - Gross Pay: $2,640                                      │
│    - Deductions: $450 (fuel + other)                       │
│    - Net Pay: $2,190                                        │
│    - Load marked as "settled"                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. REPORTS UPDATED                                          │
│    - Revenue: $360                                         │
│    - Expenses: $600 (fuel + dispatcher commission)         │
│    - Driver Pay: $2,190 (from settlement)                   │
│    - Net Profit: Calculated across all loads                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 KEY FORMULAS SUMMARY

### Dispatcher Commission
```
If commissionType === 'percentage':
  commissionAmount = totalRate × (commissionRate / 100)
  
If commissionType === 'flat_fee':
  commissionAmount = commissionRate
  
If commissionType === 'per_mile':
  commissionAmount = totalMiles × commissionRate
```

### Company Revenue
```
If Driver Type === 'Company':
  companyRevenue = totalRate  // 100%
  
If Driver Type === 'OwnerOperator':
  companyCommission = 1 - driverPayPercentage
  companyRevenue = totalRate × companyCommission
```

### Driver Gross Pay
```
If Driver Type === 'OwnerOperator':
  grossPay = totalRate × driverPayPercentage
  
If Driver Type === 'Company':
  grossPay = totalRate × driverPayPercentage  // Usually 70-80%
```

### Driver Net Pay (Settlement)
```
netPay = grossPay - deductions

Deductions = 
  + Advances
  + Lumper Fees
  + Expenses (if paidBy='company' AND deductionPreference enabled)
  + Taxes (if Company Driver)
```

### Company Net Profit
```
netProfit = totalRevenue - totalExpenses - totalDriverPay

Where:
  totalRevenue = Sum of companyRevenue from all delivered loads
  totalExpenses = Sum of company-paid expenses + dispatcher commissions
  totalDriverPay = Sum of netPay from all settlements
```

---

## 🎯 IMPORTANT NOTES

1. **Dispatcher Commission is a Company Expense**
   - NOT deducted from driver pay
   - Reduces company profit
   - Tracked separately in reports

2. **Company Revenue ≠ Total Load Amount**
   - For Owner Operators: Company gets commission only (12-15%)
   - For Company Drivers: Company gets 100% (driver paid separately)

3. **Expenses Can Be Deducted OR Company-Paid**
   - Depends on `paidBy` field and driver's `deductionPreferences`
   - Always reduces company profit regardless

4. **Settlements Are Weekly**
   - Multiple loads combined into one settlement
   - Driver gets one check per week
   - Loads marked as "settled" after settlement created

5. **Reports Use Actual Data**
   - Revenue: From `calculateCompanyRevenue()` function
   - Expenses: From `expenses` array (company-paid only)
   - Driver Pay: From `settlements` array (actual netPay)

---

## 🔍 WHERE TO FIND THE CODE

- **Load Creation**: `src/components/AddLoadModal.tsx`
- **Commission Calculation**: `src/components/AddLoadModal.tsx` (lines 95-115)
- **Company Revenue**: `src/services/utils.ts` - `calculateCompanyRevenue()`
- **Settlement Calculation**: `src/pages/Settlements.tsx` - `settlementTotals` useMemo
- **Reports Calculation**: `src/pages/Reports.tsx` - `calculateRealData()`
- **Expense Management**: `src/pages/Expenses.tsx`

