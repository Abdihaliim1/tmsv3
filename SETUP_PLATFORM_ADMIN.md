# Make Yourself a Platform Admin

To enable the company switcher (admin-only feature), add these fields to your user profile in Firestore:

## Steps

1. Go to **Firebase Console** → **Firestore Database**
2. Navigate to: `users/HpizRZ3WfgbdsYaMlrVHKmY6d4k2`
3. If the document doesn't exist, create it
4. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | `1@asal.llc` |
| `displayName` | string | `Abdihaliim` |
| `isPlatformAdmin` | boolean | `true` |
| `defaultTenantId` | string | `ats-freight` (or whichever company you want as default) |

## What this enables

- **Platform Admin = true**: Shows company switcher in header (top-right dropdown)
- **defaultTenantId**: Auto-selects this company on login if you have multiple memberships

## Normal users

Normal carrier users will:
- Login → Auto-select their company → Dashboard
- NO company picker shown
- NO multi-tenant language visible
- Clean single-company experience


