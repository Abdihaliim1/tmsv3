# Load Lifecycle Implementation - Complete System

## ✅ IMPLEMENTATION STATUS

The system now fully implements the complete load lifecycle as specified in your document. All financial calculations, detention pay, accessorials, and money flow are correctly handled.

---

## 📋 IMPLEMENTED FEATURES

### 1. ✅ Load Creation with Dispatcher
- **Dispatcher field** is now **REQUIRED** and at the top of the form
- Dispatcher commission is calculated automatically
- Commission based on **base rate** (not grand total)

### 2. ✅ Base Rate vs Grand Total
- **Base Rate**: What broker pays for the haul ($3,000)
- **Grand Total**: Base Rate + Accessorials ($3,150)
- System tracks both separately

### 3. ✅ Accessorials Support
- **Detention**: Hours × Rate (auto-calculated)
- **Layover**: Manual entry
- **Other Accessorials**: Manual entry
- **Total Accessorials**: Auto-summed
- **Grand Total**: Base Rate + Total Accessorials

### 4. ✅ Driver Pay Calculation
- **Base Pay**: Base Rate × Driver Percentage (88% = $2,640)
- **Detention Pay**: 100% pass-through to driver ($150)
- **Total Gross**: Base Pay + Detention Pay ($2,790)
- Auto-calculated when driver is assigned

### 5. ✅ Settlement Integration
- Settlements now include **detention pay** in gross pay
- Base pay + detention pay = total gross pay
- Deductions applied to gross pay

### 6. ✅ Invoice Generation
- Invoices use **grandTotal** (includes accessorials)
- Invoice amount = Base Rate + Accessorials

---

## 💰 MONEY FLOW (As Implemented)

### Example: Load LD-2025-100

```
BROKER PAYS: $3,150
├── Base Rate:     $3,000
└── Detention:     $150 (2 hrs × $75)

COMPANY DISTRIBUTES:
├──► DRIVER:       $2,790
│   ├── Base Pay:  $2,640 (88% of $3,000)
│   └── Detention: $150 (100% pass-through)
│
├──► DISPATCHER:   $150
│   └── Commission: $150 (5% of $3,000 base rate)
│
└──► COMPANY:      $210
    └── $3,150 - $2,790 - $150 = $210
```

**Verification:** $2,790 + $150 + $210 = $3,150 ✓

---

## 🔧 HOW IT WORKS IN THE SYSTEM

### Step 1: Create Load

**User Actions:**
1. Select **Dispatcher** (Ali) - **REQUIRED** at top
2. Enter **Base Rate**: $3,000
3. Enter **Miles**: 355
4. Check **"Has Detention"**
5. Enter **Detention Hours**: 2
6. Enter **Detention Rate**: $75/hr
7. System auto-calculates:
   - Detention Amount: $150
   - Total Accessorials: $150
   - Grand Total: $3,150
   - Dispatcher Commission: $150 (5% of base rate)

**System Calculations:**
```typescript
// Detention
detentionAmount = detentionHours × detentionRate
detentionAmount = 2 × 75 = $150

// Accessorials
totalAccessorials = detentionAmount + layoverAmount + otherAccessorials
totalAccessorials = $150 + $0 + $0 = $150

// Grand Total
grandTotal = baseRate + totalAccessorials
grandTotal = $3,000 + $150 = $3,150

// Dispatcher Commission (on base rate only)
dispatcherCommissionAmount = baseRate × (commissionRate / 100)
dispatcherCommissionAmount = $3,000 × (5 / 100) = $150
```

### Step 2: Assign Driver

**User Actions:**
1. Select **Driver**: John Doe (Owner Operator, 88%)

**System Calculations:**
```typescript
// Driver Base Pay
driverBasePay = baseRate × (payRate / 100)
driverBasePay = $3,000 × (88 / 100) = $2,640

// Driver Detention Pay (100% pass-through)
driverDetentionPay = detentionAmount
driverDetentionPay = $150

// Driver Total Gross
driverTotalGross = driverBasePay + driverDetentionPay
driverTotalGross = $2,640 + $150 = $2,790
```

### Step 3: Load Delivered

**System Actions:**
- When status changes to "Delivered":
  - Invoice auto-created with amount = **grandTotal** ($3,150)
  - Load marked as available for settlement

### Step 4: Generate Settlement

**System Calculations:**
```typescript
// For each load in settlement:
basePay = load.rate × driverPayPercentage
basePay = $3,000 × 0.88 = $2,640

detentionPay = load.detentionAmount || 0
detentionPay = $150

layoverPay = load.layoverAmount || 0
layoverPay = $0

loadGrossPay = basePay + detentionPay + layoverPay
loadGrossPay = $2,640 + $150 + $0 = $2,790

// Total Gross Pay (sum of all loads)
grossPay += loadGrossPay

// Net Pay
netPay = grossPay - deductions
```

### Step 5: Invoice to Broker

**Invoice Amount:**
```typescript
invoiceAmount = load.grandTotal || load.rate
invoiceAmount = $3,150  // Includes base rate + detention
```

---

## 📊 DATA STRUCTURE

### Load Object (After Implementation)

```typescript
{
  id: "load-123",
  loadNumber: "LD-2025-100",
  
  // Base Financials
  rate: 3000,              // Base rate (what broker pays for haul)
  grandTotal: 3150,        // Base rate + accessorials
  
  // Accessorials
  hasDetention: true,
  detentionLocation: "delivery",
  detentionHours: 2,
  detentionRate: 75,
  detentionAmount: 150,    // Auto: 2 × 75
  layoverAmount: 0,
  otherAccessorials: 0,
  totalAccessorials: 150,  // Auto: detention + layover + other
  
  // Driver Pay Breakdown
  driverBasePay: 2640,     // Auto: rate × 88%
  driverDetentionPay: 150, // Auto: 100% pass-through
  driverTotalGross: 2790,  // Auto: base + detention
  
  // Dispatcher
  dispatcherId: "ali-id",
  dispatcherName: "Ali",
  dispatcherCommissionType: "percentage",
  dispatcherCommissionRate: 5,
  dispatcherCommissionAmount: 150, // Auto: rate × 5%
  
  // ... other fields
}
```

---

## ✅ VERIFICATION CHECKLIST

- [x] Dispatcher field is required and at top of form
- [x] Base rate is separate from grand total
- [x] Detention can be added with hours and rate
- [x] Detention amount auto-calculates (hours × rate)
- [x] Total accessorials auto-calculates
- [x] Grand total auto-calculates (base + accessorials)
- [x] Driver base pay calculated from base rate
- [x] Driver detention pay is 100% pass-through
- [x] Driver total gross includes detention
- [x] Dispatcher commission calculated on base rate
- [x] Settlements include detention pay
- [x] Invoices use grand total (includes accessorials)

---

## 🎯 KEY FORMULAS (As Implemented)

```typescript
// DETENTION
detentionAmount = detentionHours × detentionRate

// ACCESSORIALS
totalAccessorials = detentionAmount + layoverAmount + otherAccessorials

// GRAND TOTAL
grandTotal = baseRate + totalAccessorials

// DISPATCHER COMMISSION (on base rate)
dispatcherCommissionAmount = baseRate × (commissionRate / 100)

// DRIVER BASE PAY
driverBasePay = baseRate × (payRate / 100)

// DRIVER DETENTION PAY (100% pass-through)
driverDetentionPay = detentionAmount

// DRIVER TOTAL GROSS
driverTotalGross = driverBasePay + driverDetentionPay + layoverPay

// COMPANY PROFIT
companyProfit = grandTotal - driverTotalGross - dispatcherCommissionAmount
```

---

## 📝 WHERE TO FIND THE CODE

- **Load Type Definition**: `src/types.ts` - `Load` interface
- **Load Creation Modal**: `src/components/AddLoadModal.tsx`
- **Settlement Calculation**: `src/pages/Settlements.tsx` - `settlementTotals` useMemo
- **Invoice Generation**: `src/context/TMSContext.tsx` - `addLoad` function
- **Driver Pay Calculation**: `src/components/AddLoadModal.tsx` - useEffect hooks

---

## 🚀 READY TO USE

The system now fully implements the complete load lifecycle with:
- ✅ Detention pay tracking
- ✅ Accessorials support
- ✅ Proper money flow calculations
- ✅ Dispatcher commission on base rate
- ✅ Driver pay including detention
- ✅ Grand total for invoicing
- ✅ Settlement integration

**All calculations match your specification exactly!**

