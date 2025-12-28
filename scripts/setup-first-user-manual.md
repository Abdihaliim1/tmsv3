# Manual Setup: Create First Tenant and User Membership

Since the app is now deployed, you need to create a tenant and user membership in Firestore.

## Option 1: Use Firebase Console (Easiest)

### Step 1: Create Tenant Document

1. Go to Firebase Console → Firestore Database
2. Click "Start collection"
3. Collection ID: `tenants`
4. Document ID: `default` (or any ID you want)
5. Add these fields:
   ```
   id: string = "default"
   name: string = "Your Company Name"
   status: string = "active"
   createdAt: timestamp = (current time)
   updatedAt: timestamp = (current time)
   ```

### Step 2: Create User Membership

1. In Firestore, navigate to: `users/{your-user-uid}/memberships`
2. Click "Start collection" (if users collection doesn't exist)
3. Collection ID: `memberships`
4. Document ID: `default` (same as tenant ID)
5. Add these fields:
   ```
   tenantId: string = "default"
   tenantName: string = "Your Company Name"
   role: string = "admin"
   active: boolean = true
   joinedAt: timestamp = (current time)
   ```

### Step 3: Get Your User UID

1. Go to Firebase Console → Authentication
2. Find your user email (`abdixaliim@gmail.com` or whatever you use)
3. Copy the UID (it's in the user details)

## Option 2: Use Firebase Console Script (Recommended)

1. Go to Firebase Console → Firestore Database
2. Click "Start collection"
3. Collection ID: `tenants`
4. Document ID: `default`
5. Add fields as shown above

Then for the membership:
1. Go to: `users/{YOUR_UID}/memberships/default`
2. Add fields as shown above

## Quick Setup via Browser Console

Open your browser console on the deployed app and run:

```javascript
// First, get your user UID from Firebase Auth
// Then run this in Firebase Console → Firestore → Start collection

// 1. Create tenant at: tenants/default
{
  id: "default",
  name: "Your Company Name",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

// 2. Create membership at: users/{YOUR_UID}/memberships/default
{
  tenantId: "default",
  tenantName: "Your Company Name",
  role: "admin",
  active: true,
  joinedAt: new Date().toISOString()
}
```

## After Setup

1. Refresh the app at https://app.somtms.com
2. You should now see the dashboard instead of "No Company Access"
3. You'll be logged in as admin of the default tenant

## Need Help?

If you need your user UID:
1. Login to the app
2. Open browser console
3. Run: `firebase.auth().currentUser.uid` (if using Firebase SDK)
4. Or check Firebase Console → Authentication → Users


