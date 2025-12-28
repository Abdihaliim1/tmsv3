# Fix "Failed to load company information" Error

## Quick Fix: Add Missing `status` Field

The error happens because the tenant documents might be missing the `status` field. Let's add it:

### Step 1: Fix Tenant Documents

1. Go to Firestore: https://console.firebase.google.com/project/somtms-fec81/firestore
2. Click on `tenants` collection
3. Click on `sars-logistics` document
4. Click "+ Add field"
5. Field name: `status`
6. Type: `string`
7. Value: `active`
8. Click "Save"

### Step 2: Repeat for ATS Freight

1. Click on `ats-freight` document
2. Click "+ Add field"
3. Field name: `status`
4. Type: `string`
5. Value: `active`
6. Click "Save"

### Step 3: Test Again

1. Go to: https://app.somtms.com
2. Refresh the page
3. Click on a company
4. The error should be gone!

## Alternative: Check Browser Console

If the error persists:

1. Open browser console (F12)
2. Look for error messages
3. Check if it says "permission-denied" (Firestore rules issue)
4. Or "not-found" (tenant document missing)

Let me know what you see!


