# Create Multiple Tenants for Companies

## Companies to Create:
1. **Sars Logistics LLC**
2. **ATS Freight LLC**
3. **Sample Freight LLC**

## Step-by-Step Instructions

### For Each Company, Create a Tenant Document:

#### Company 1: Sars Logistics LLC

1. Go to Firestore: https://console.firebase.google.com/project/somtms-fec81/firestore
2. Click "Start collection" (or add to existing `tenants` collection)
3. Collection ID: `tenants`
4. Document ID: `sars-logistics` (or `sars-logistics-llc`)
5. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `sars-logistics` |
| `name` | string | `Sars Logistics LLC` |
| `status` | string | `active` |
| `createdAt` | timestamp | (Set to Now) |
| `updatedAt` | timestamp | (Set to Now) |

6. Click "Save"

#### Company 2: ATS Freight LLC

1. Still in `tenants` collection, click "Add document"
2. Document ID: `ats-freight` (or `ats-freight-llc`)
3. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `ats-freight` |
| `name` | string | `ATS Freight LLC` |
| `status` | string | `active` |
| `createdAt` | timestamp | (Set to Now) |
| `updatedAt` | timestamp | (Set to Now) |

4. Click "Save"

#### Company 3: Sample Freight LLC

1. Still in `tenants` collection, click "Add document"
2. Document ID: `sample-freight` (or `sample-freight-llc`)
3. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `sample-freight` |
| `name` | string | `Sample Freight LLC` |
| `status` | string | `active` |
| `createdAt` | timestamp | (Set to Now) |
| `updatedAt` | timestamp | (Set to Now) |

4. Click "Save"

## Create User Memberships for Each Company

Now you need to create memberships for your user (UID: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2`) for each company:

### Membership 1: Sars Logistics LLC

1. Navigate to: `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2`
2. Click "Start subcollection" (if memberships doesn't exist)
3. Subcollection ID: `memberships`
4. Document ID: `sars-logistics` (must match tenant ID)
5. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `tenantId` | string | `sars-logistics` |
| `tenantName` | string | `Sars Logistics LLC` |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `joinedAt` | timestamp | (Set to Now) |

6. Click "Save"

### Membership 2: ATS Freight LLC

1. Still in `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2/memberships`
2. Click "Add document"
3. Document ID: `ats-freight` (must match tenant ID)
4. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `tenantId` | string | `ats-freight` |
| `tenantName` | string | `ATS Freight LLC` |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `joinedAt` | timestamp | (Set to Now) |

5. Click "Save"

### Membership 3: Sample Freight LLC

1. Still in `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2/memberships`
2. Click "Add document"
3. Document ID: `sample-freight` (must match tenant ID)
4. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `tenantId` | string | `sample-freight` |
| `tenantName` | string | `Sample Freight LLC` |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `joinedAt` | timestamp | (Set to Now) |

5. Click "Save"

## Result

After setup, you'll have:

```
tenants/
  ├── sars-logistics
  ├── ats-freight
  └── sample-freight

users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2/memberships/
  ├── sars-logistics
  ├── ats-freight
  └── sample-freight
```

## Testing

1. Go to: https://app.somtms.com
2. Login
3. You should see a **company picker** with 3 companies:
   - Sars Logistics LLC
   - ATS Freight LLC
   - Sample Freight LLC
4. Select any company to access that company's data

## Notes

- Each company has **isolated data** (loads, drivers, invoices, etc.)
- You can switch between companies using the company picker
- Each company can have different users with different roles
- To add more users to a company, create memberships at: `users/{USER_UID}/memberships/{tenantId}`


