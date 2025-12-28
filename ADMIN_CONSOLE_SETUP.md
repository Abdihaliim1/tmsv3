# Admin Console Setup Guide

## ✅ What's Implemented

### 1. Admin Console Page (`/admin`)
- Search companies by name, tenant ID, MC#, DOT#
- View all companies in a list
- "Enter Company" to view their data
- Global issues overview (mock data for now)

### 2. Admin Mode Banner
- Yellow banner at top when viewing a company
- Shows "ADMIN MODE: Viewing [Company Name]"
- "Exit Admin Mode" button returns to Admin Console

### 3. Routing
- **Platform Admins**: Login → Admin Console (if no tenant selected)
- **Normal Users**: Login → Dashboard (auto-select company)

### 4. User Menu
- Platform admins see "Platform Admin" badge
- "Admin Console" link in user dropdown menu

---

## Setup: Make Yourself a Platform Admin

### In Firestore:

1. Go to `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2`
2. Add/update field:
   - `isPlatformAdmin`: `true` (boolean)

---

## Setup: Create tenantsIndex Collection

For the Admin Console to list all companies, create a `tenantsIndex` collection:

### Step 1: Go to Firestore → Create Collection
- Collection ID: `tenantsIndex`

### Step 2: Add documents for each company

**Document 1: `ats-freight`**
```
name: "ATS Freight LLC"
status: "active"
createdAt: (timestamp)
userCount: 1
mcNumber: "123456"
dotNumber: "789012"
```

**Document 2: `sars-logistics`**
```
name: "Sars Logistics LLC"
status: "active"
createdAt: (timestamp)
userCount: 1
```

---

## How It Works

### Normal User Flow:
```
Login → Auto-select company → Dashboard
        (no picker, ever)
```

### Platform Admin Flow:
```
Login → Admin Console → Search/Select Company → Enter Company → Dashboard
                                                      ↓
                                        (Yellow banner shows admin mode)
                                                      ↓
                                        Exit Admin Mode → Admin Console
```

### Admin Mode Session Storage:
- `somtms_adminMode`: "true" when in admin mode
- `somtms_adminViewingTenant`: tenant ID being viewed
- `somtms_adminViewingTenantName`: company name for banner

---

## Security Notes

1. Only `isPlatformAdmin === true` users can access Admin Console
2. Normal users are redirected to Dashboard if they try to access `/admin`
3. Firestore rules should prevent non-admins from reading `tenantsIndex`

### Recommended Firestore Rules:
```javascript
// tenantsIndex - platform admins only
match /tenantsIndex/{tenantId} {
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isPlatformAdmin == true;
  allow write: if false; // Only update via Cloud Functions
}

// Protect isPlatformAdmin field
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow update: if request.auth.uid == userId && 
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['isPlatformAdmin']);
}
```

---

## Test It

1. Go to https://app.somtms.com
2. Login as `1@asal.llc` 
3. If you have `isPlatformAdmin: true`:
   - You'll see Admin Console
   - Click "Enter Company" on any company
   - See yellow admin banner
   - Click "Exit Admin Mode" to return

4. If you don't have `isPlatformAdmin`:
   - You'll go straight to Dashboard
   - No admin features visible


