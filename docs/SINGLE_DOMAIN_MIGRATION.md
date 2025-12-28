# Single Domain Multi-Tenant Migration

## Summary

Migrated from subdomain-based multi-tenancy to single-domain with user membership-based tenant resolution.

**New App URL**: `https://app.somtms.com`

## Changes Made

### 1. Removed Subdomain Logic
- ✅ Deleted `getTenantFromSubdomain()` function
- ✅ Removed all `hostname` parsing
- ✅ Removed all subdomain-based tenant detection
- ✅ Updated `src/utils/tenant.ts` to only contain helper functions

### 2. New Tenant Resolution
- ✅ Created `TenantContext` that loads tenant from user memberships
- ✅ Membership model: `users/{uid}/memberships/{tenantId}`
- ✅ Auto-selects tenant if user has only one membership
- ✅ Shows company picker if user has multiple memberships

### 3. Company Picker Page
- ✅ Created `/select-company` page
- ✅ Shows all user memberships
- ✅ Allows user to select which company to access
- ✅ Persists selection in `sessionStorage`

### 4. Updated All Services
- ✅ `TMSContext` now uses `activeTenantId` from `TenantContext`
- ✅ All workflow functions now accept `tenantId` as parameter
- ✅ All Firestore queries use `activeTenantId` from context
- ✅ Removed all subdomain references from services

### 5. Firestore Security Rules
- ✅ Updated to use new membership model: `users/{uid}/memberships/{tenantId}`
- ✅ Removed any hostname/subdomain logic
- ✅ All rules enforce tenant membership checks

### 6. Session Management
- ✅ Tenant selection stored in `sessionStorage["somtms_activeTenantId"]`
- ✅ Redirect path stored in `sessionStorage["somtms_redirectAfterTenantSelect"]`
- ✅ Cleared on logout

## Data Model

### User Membership
```
users/{uid}/memberships/{tenantId}
{
  tenantId: string,
  tenantName: string,
  role: 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer',
  active: boolean,
  joinedAt: string
}
```

### Tenant Document
```
tenants/{tenantId}
{
  id: string,
  name: string,
  status: 'active' | 'inactive' | 'suspended',
  createdAt?: string,
  updatedAt?: string,
  tenantSlug?: string  // Optional, for internal search only
}
```

## Next Steps (Manual)

1. **Firebase Hosting Setup**:
   ```bash
   firebase login
   firebase use <YOUR_FIREBASE_PROJECT_ID>
   firebase init hosting  # If not already done
   npm run build
   firebase deploy --only hosting
   ```

2. **Add Custom Domain**:
   - Firebase Console → Hosting → Add custom domain
   - Add: `app.somtms.com`
   - Follow Firebase's DNS instructions

3. **Create Initial Memberships**:
   - For existing users, create membership documents:
   ```javascript
   // Example: Add user to tenant
   await setDoc(doc(db, `users/${uid}/memberships/${tenantId}`), {
     tenantId,
     tenantName: 'Company Name',
     role: 'admin',
     active: true,
     joinedAt: new Date().toISOString()
   });
   ```

4. **Update Tenant Creation Flow**:
   - Remove slug requirement
   - Create membership for creator automatically
   - Update any admin tools that create tenants

## Testing Checklist

- [ ] Single-tenant user logs in → goes straight to dashboard
- [ ] Multi-tenant user logs in → sees company picker
- [ ] Switching company changes data everywhere
- [ ] All writes go to correct tenant paths
- [ ] Logout clears tenant selection
- [ ] Deep links work after login + tenant selection
- [ ] No hostname/subdomain parsing remains
- [ ] App works on localhost and production (same behavior)


