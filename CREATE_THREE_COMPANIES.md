# 🏢 Create Three Companies: Quick Guide

## Companies:
1. **Sars Logistics LLC** → Tenant ID: `sars-logistics`
2. **ATS Freight LLC** → Tenant ID: `ats-freight`
3. **Sample Freight LLC** → Tenant ID: `sample-freight`

## 📋 Quick Reference Table

| Company Name | Tenant Document ID | Membership Document ID |
|--------------|-------------------|----------------------|
| Sars Logistics LLC | `sars-logistics` | `sars-logistics` |
| ATS Freight LLC | `ats-freight` | `ats-freight` |
| Sample Freight LLC | `sample-freight` | `sample-freight` |

## 🚀 Step-by-Step (Firebase Console)

### Part 1: Create Tenants (3 documents)

**Go to:** https://console.firebase.google.com/project/somtms-fec81/firestore

#### Tenant 1: Sars Logistics LLC
1. Collection: `tenants`
2. Document ID: `sars-logistics`
3. Fields:
   - `id`: `sars-logistics`
   - `name`: `Sars Logistics LLC`
   - `status`: `active`
   - `createdAt`: (timestamp - Now)
   - `updatedAt`: (timestamp - Now)

#### Tenant 2: ATS Freight LLC
1. Collection: `tenants`
2. Document ID: `ats-freight`
3. Fields:
   - `id`: `ats-freight`
   - `name`: `ATS Freight LLC`
   - `status`: `active`
   - `createdAt`: (timestamp - Now)
   - `updatedAt`: (timestamp - Now)

#### Tenant 3: Sample Freight LLC
1. Collection: `tenants`
2. Document ID: `sample-freight`
3. Fields:
   - `id`: `sample-freight`
   - `name`: `Sample Freight LLC`
   - `status`: `active`
   - `createdAt`: (timestamp - Now)
   - `updatedAt`: (timestamp - Now)

### Part 2: Create Memberships (3 documents)

**Go to:** `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2/memberships`

#### Membership 1: Sars Logistics LLC
1. Document ID: `sars-logistics`
2. Fields:
   - `tenantId`: `sars-logistics`
   - `tenantName`: `Sars Logistics LLC`
   - `role`: `admin`
   - `active`: `true`
   - `joinedAt`: (timestamp - Now)

#### Membership 2: ATS Freight LLC
1. Document ID: `ats-freight`
2. Fields:
   - `tenantId`: `ats-freight`
   - `tenantName`: `ATS Freight LLC`
   - `role`: `admin`
   - `active`: `true`
   - `joinedAt`: (timestamp - Now)

#### Membership 3: Sample Freight LLC
1. Document ID: `sample-freight`
2. Fields:
   - `tenantId`: `sample-freight`
   - `tenantName`: `Sample Freight LLC`
   - `role`: `admin`
   - `active`: `true`
   - `joinedAt`: (timestamp - Now)

## ✅ After Setup

1. Go to: https://app.somtms.com
2. Login
3. You'll see a **company picker** with all 3 companies
4. Select any company to access that company's dashboard

## 📊 Final Structure

```
Firestore:
├── tenants/
│   ├── sars-logistics
│   ├── ats-freight
│   └── sample-freight
│
└── users/
    └── HpizRZ3WfgbdsYaMlrVHKmY6d4k2/
        └── memberships/
            ├── sars-logistics
            ├── ats-freight
            └── sample-freight
```

## 💡 Tips

- **Tenant IDs** should be lowercase, use hyphens (e.g., `sars-logistics`)
- **Membership Document ID** must match the **Tenant ID** exactly
- Each company has **completely isolated data**
- You can switch companies anytime using the company picker


