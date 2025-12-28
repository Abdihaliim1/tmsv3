# Multi-Tenant + RBAC + Audit Trail Implementation

**Date**: 2025-01-27  
**Status**: ✅ **IMPLEMENTED**

---

## ✅ **COMPLETED FEATURES**

### 1. Firestore Multi-Tenant Data Structure ✅

**Path Structure**: `tenants/{tenantId}/...`

All data is now scoped by tenant:
- `tenants/{tenantId}/loads/{loadId}`
- `tenants/{tenantId}/invoices/{invoiceId}`
- `tenants/{tenantId}/settlements/{settlementId}`
- `tenants/{tenantId}/employees/{employeeId}`
- `tenants/{tenantId}/auditLogs/{logId}`
- `tenants/{tenantId}/loads/{loadId}/adjustments/{adjId}`

**Tenant Membership**: `tenants/{tenantId}/users/{uid}`

---

### 2. Firestore Security Rules ✅

**File**: `firestore.rules`

**Features**:
- ✅ Tenant membership check
- ✅ Role-based access control (RBAC)
- ✅ No updates/deletes in audit logs (immutable)
- ✅ Restrict deletes to admin only
- ✅ Role-based write permissions

**Helper Functions**:
- `getUserRole(uid)` - Get user role from users collection
- `isAdmin(uid)` - Check if user is admin
- `isTenantMember(tenantId, uid)` - Check tenant membership
- `canAccessTenant(tenantId, uid)` - Combined check

**Rules Summary**:
- **Read**: All tenant members can read their tenant's data
- **Create**: Based on role (admin, dispatcher, accountant)
- **Update**: Based on role
- **Delete**: Admin only (except tasks - can delete own tasks)
- **Audit Logs**: Read-only for admins/accountants, no updates/deletes

---

### 3. Transaction-Safe Counters ✅

**File**: `src/services/counterService.ts`

**Features**:
- ✅ Atomic counter generation using Firestore transactions
- ✅ Uniqueness guards
- ✅ Year-based counters (resets each year)
- ✅ Supports: invoice, load, settlement

**Functions**:
- `getNextCounter(tenantId, counterType, year?)` - Get next sequence number
- `generateUniqueInvoiceNumber(tenantId)` - Generate INV-YYYY-NNNN
- `generateUniqueLoadNumber(tenantId)` - Generate LD-YYYY-NNNN
- `generateUniqueSettlementNumber(tenantId, prefix?)` - Generate SET-YYYY-NNNN
- `invoiceNumberExists(tenantId, invoiceNumber)` - Uniqueness check
- `syncCounter(...)` - Recovery function

**Counter Path**: `tenants/{tenantId}/counters/{counterType}_{year}`

**Example**:
```typescript
const invoiceNumber = await generateUniqueInvoiceNumber('tenant-123');
// Returns: "INV-2025-1001"
```

---

### 4. Universal Audit Trail ✅

**File**: `src/data/audit.ts`

**Features**:
- ✅ Logs all CREATE/UPDATE/DELETE/STATUS_CHANGE/ADJUSTMENT actions
- ✅ Includes metadata: userAgent, path, actor info
- ✅ Before/after diffs
- ✅ Required reason for adjustments
- ✅ Fallback to localStorage if Firestore fails

**Functions**:
- `writeAuditLog(params)` - Generic audit log
- `auditCreate(...)` - CREATE action
- `auditUpdate(...)` - UPDATE action
- `auditDelete(...)` - DELETE action
- `auditStatusChange(...)` - STATUS_CHANGE action
- `auditAdjustment(...)` - ADJUSTMENT action (requires reason)

**Audit Log Path**: `tenants/{tenantId}/auditLogs/{logId}`

**Audit Log Structure**:
```typescript
{
  tenantId: string;
  actorUid: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "ADJUSTMENT";
  summary: string;
  before?: any;
  after?: any;
  reason?: string;
  userAgent: string;
  path: string;
  createdAt: Timestamp;
  timestamp: string;
}
```

---

### 5. Delivered-Load Locking ✅

**File**: `src/services/loadLocking.ts`

**Features**:
- ✅ Locks loads when status is DELIVERED or COMPLETED
- ✅ Blocks direct edits to locked fields
- ✅ Allows document uploads and notes
- ✅ Requires adjustment workflow for locked fields

**Locked Fields** (cannot be modified after delivery):
- `rate`, `miles`, `pickupDate`, `deliveryDate`
- `originCity`, `originState`, `destCity`, `destState`
- `brokerId`, `brokerName`, `driverId`, `driverName`
- `grandTotal`, `driverBasePay`, `driverTotalGross`

**Allowed Fields** (can be updated after delivery):
- `documents` - Document uploads
- `notes` - Internal notes
- `podNumber`, `bolNumber` - Document numbers
- `status` - Status changes (e.g., DELIVERED -> COMPLETED)
- `invoiceId`, `settlementId` - Linking

**Functions**:
- `isLoadLocked(load)` - Check if load is locked
- `validatePostDeliveryUpdate(load, field, newValue)` - Validate single field
- `validatePostDeliveryUpdates(load, updates)` - Validate full update object

---

### 6. Adjustment Approval Workflow ✅

**File**: `src/services/adjustmentService.ts`

**Features**:
- ✅ Create adjustment requests for delivered loads
- ✅ Auto-apply or require approval
- ✅ Approve/reject adjustments
- ✅ Track adjustment history

**Adjustment Path**: `tenants/{tenantId}/loads/{loadId}/adjustments/{adjId}`

**Adjustment Structure**:
```typescript
{
  id: string;
  loadId: string;
  tenantId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  patch: Record<string, any>; // Fields to update
  reason: string; // Required
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}
```

**Functions**:
- `createAdjustment(...)` - Create adjustment (auto-apply or pending)
- `approveAdjustment(...)` - Approve and apply adjustment
- `rejectAdjustment(...)` - Reject adjustment
- `getLoadAdjustments(...)` - Get all adjustments for a load

**Usage**:
```typescript
// Auto-apply (no approval needed)
await createAdjustment(tenantId, loadId, { rate: 1200 }, 'Rate correction', userId, false);

// Require approval
await createAdjustment(tenantId, loadId, { rate: 1200 }, 'Rate correction', userId, true);

// Approve
await approveAdjustment(tenantId, loadId, adjustmentId, adminUserId);
```

---

## 🔧 **INTEGRATION**

### TMSContext Updates

**File**: `src/context/TMSContext.tsx`

**Changes**:
- ✅ Integrated audit logging into `addLoad()`, `updateLoad()`
- ✅ Enforced load locking in `updateLoad()`
- ✅ Added `reason` parameter to `updateLoad()` for adjustments
- ✅ Auto-locks loads when status changes to DELIVERED/COMPLETED

**Example**:
```typescript
// Regular update (not locked)
await updateLoad(loadId, { notes: 'Updated notes' });

// Adjustment to delivered load (requires reason)
await updateLoad(loadId, { rate: 1200 }, 'Rate correction per broker');
```

---

## 📋 **FIREBASE SETUP**

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

Or manually copy `firestore.rules` to Firebase Console → Firestore Database → Rules

### 2. Create Tenant Membership

When a user joins a tenant, create:
```
tenants/{tenantId}/users/{uid}
{
  role: 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer',
  joinedAt: Timestamp,
  addedBy: string
}
```

### 3. Initialize Counters

Counters are created automatically on first use, but you can initialize:
```
tenants/{tenantId}/counters/invoice_2025
{
  year: 2025,
  seq: 1000,
  lastUpdated: Timestamp
}
```

---

## 🧪 **TESTING**

### Test Load Locking

1. Create a load
2. Mark as DELIVERED
3. Try to update `rate` → Should fail
4. Try to update `documents` → Should succeed
5. Create adjustment for `rate` → Should succeed

### Test Audit Trail

1. Create a load → Check `auditLogs` collection
2. Update load → Check audit log entry
3. Change status → Check STATUS_CHANGE audit
4. Delete load (admin) → Check DELETE audit

### Test Counters

1. Create multiple invoices → Verify sequential numbers
2. Check uniqueness → No duplicates
3. Test year rollover → Counter resets

---

## ⚠️ **IMPORTANT NOTES**

1. **Tenant ID**: Must be set correctly for all operations
2. **User Roles**: Must be set in `users/{uid}` collection
3. **Tenant Membership**: Must exist in `tenants/{tenantId}/users/{uid}`
4. **Audit Logs**: Immutable - no updates/deletes allowed
5. **Load Locking**: Enforced client-side and server-side (via rules)
6. **Adjustments**: Use for post-delivery changes to locked fields

---

## 📚 **NEXT STEPS**

1. **Migrate Existing Data**: Move from localStorage to Firestore with tenant structure
2. **Collection Group Queries**: Optimize `getPendingAdjustments()` with collection group
3. **Email Notifications**: Notify admins of pending adjustments
4. **Adjustment UI**: Create UI for viewing/approving adjustments
5. **Audit Log Viewer**: Create admin page to view audit logs

---

**END OF IMPLEMENTATION GUIDE**


