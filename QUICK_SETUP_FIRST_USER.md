# 🚀 Quick Setup: First User Access

Your app is deployed but showing "No Company Access" because you need to create a tenant and membership.

## ⚡ Fastest Way (5 minutes)

### 1. Get Your User UID

**Option A: From Firebase Console**
1. Go to: https://console.firebase.google.com/project/somtms-fec81/authentication/users
2. Find your email (`abdixaliim@gmail.com`)
3. Click on it → Copy the **UID** (looks like: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2`)

**Option B: From Browser Console**
1. Visit: https://app.somtms.com
2. Open browser console (F12)
3. Login if needed
4. The UID will be in the console logs or check localStorage

### 2. Create Tenant in Firestore

1. Go to: https://console.firebase.google.com/project/somtms-fec81/firestore
2. Click **"Start collection"**
3. Collection ID: `tenants`
4. Document ID: `default`
5. Click **"Add field"** and add:

| Field | Type | Value |
|-------|------|-------|
| `id` | string | `default` |
| `name` | string | `Your Company Name` |
| `status` | string | `active` |
| `createdAt` | timestamp | (click "Set" → "Now") |
| `updatedAt` | timestamp | (click "Set" → "Now") |

6. Click **"Save"**

### 3. Create User Membership

1. Still in Firestore, click **"Start collection"** again
2. Collection ID: `users`
3. Document ID: `{YOUR_UID}` (paste your UID from step 1)
4. Click **"Save"** (creates the users document)
5. Now click on the `users/{YOUR_UID}` document
6. Click **"Start subcollection"**
7. Subcollection ID: `memberships`
8. Document ID: `default`
9. Click **"Add field"** and add:

| Field | Type | Value |
|-------|------|-------|
| `tenantId` | string | `default` |
| `tenantName` | string | `Your Company Name` |
| `role` | string | `admin` |
| `active` | boolean | `true` |
| `joinedAt` | timestamp | (click "Set" → "Now") |

10. Click **"Save"**

### 4. Test

1. Go to: https://app.somtms.com
2. Refresh the page
3. You should now see the dashboard! 🎉

## 📋 Summary

You created:
- ✅ Tenant: `tenants/default`
- ✅ Membership: `users/{YOUR_UID}/memberships/default`

## 🔧 Troubleshooting

**Still seeing "No Company Access"?**
- Make sure the `tenantId` in membership matches the tenant `id`
- Make sure `active` is set to `true` (not `false`)
- Check that your UID is correct
- Refresh the page (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)

**Need to add more users?**
- Create memberships at: `users/{NEW_USER_UID}/memberships/{tenantId}`
- Set `role` to: `admin`, `dispatcher`, `driver`, `accountant`, or `viewer`


