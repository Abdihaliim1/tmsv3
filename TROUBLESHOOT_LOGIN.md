# 🔴 Troubleshooting Login Error

## Current Error
"Failed to sign in. Please check your email and password."

## ✅ **Most Common Issue: User Not in Firebase Authentication**

You created the user document in **Firestore**, but the user also needs to exist in **Firebase Authentication**.

---

## 🔧 **Fix: Create User in Firebase Authentication**

### Step 1: Go to Authentication

1. Open Firebase Console: https://console.firebase.google.com/
2. Select project: **somtms-fec81**
3. Click **Authentication** (left sidebar)

### Step 2: Check if User Exists

1. Click **"Users"** tab
2. Look for email: `1@asal.llc`
3. If you see it → Check the password
4. If you DON'T see it → Continue to Step 3

### Step 3: Create User in Authentication

1. Click **"Add user"** button (top)
2. **Email**: `1@asal.llc`
3. **Password**: Enter a strong password (remember this!)
4. Click **"Add user"**

**Important**: The User UID should match: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2`

If it doesn't match:
- The UID in Firestore needs to match the UID in Authentication
- Either:
  - Delete the Firestore document and create a new one with the correct UID
  - OR update the Firestore document ID to match the Authentication UID

---

## ✅ **Alternative: Reset Password**

If the user already exists in Authentication:

1. Go to **Authentication** → **Users**
2. Find `1@asal.llc`
3. Click the three dots (⋮) next to the user
4. Click **"Reset password"**
5. Enter a new password
6. Try logging in again

---

## 🔍 **Check These Things**

### 1. User Exists in Authentication?
- ✅ Go to Authentication → Users
- ✅ Look for `1@asal.llc`
- ✅ If missing, create it (Step 3 above)

### 2. User UID Matches?
- ✅ Authentication UID should match Firestore document ID
- ✅ Current Firestore doc ID: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2`
- ✅ Check if Authentication user has the same UID

### 3. Password Correct?
- ✅ Make sure you're using the password you set
- ✅ Try resetting password if unsure

### 4. Email/Password Enabled?
- ✅ Go to Authentication → Sign-in method
- ✅ Make sure "Email/Password" is **Enabled**

---

## 🧪 **Quick Test**

After creating the user in Authentication:

1. **Refresh the login page**
2. **Enter email**: `1@asal.llc`
3. **Enter password**: (the password you set)
4. **Click "Sign In"**

---

## 🆘 **Still Not Working?**

Check browser console (F12) for specific error messages:
- `auth/user-not-found` → User doesn't exist in Authentication
- `auth/wrong-password` → Password is incorrect
- `auth/invalid-email` → Email format issue
- `auth/too-many-requests` → Too many failed attempts (wait a bit)

---

**Most likely fix: Create the user in Firebase Authentication (not just Firestore)!**


