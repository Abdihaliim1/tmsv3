# 🔴 Quick Fix: Firebase Configuration Error

## The Problem

You're seeing:
- `Firebase configuration is missing. Please set environment variables.`
- `FirebaseError: Firebase: Error (auth/invalid-api-key).`

**This means your `.env` file is missing or has incorrect values.**

---

## ✅ **3-Step Fix**

### Step 1: Create `.env` File

**Option A: Manual (Recommended)**
1. Create a file named `.env` in the project root
2. Copy the template below and fill in your Firebase values

**Option B: Use Helper Script**
```bash
./create-env.sh
```

### Step 2: Get Firebase Config Values

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select/Create Project**
3. **Click ⚙️ (gear icon) → Project Settings**
4. **Scroll to "Your apps" section**
5. **Click Web icon (`</>`)**
6. **If no web app exists:**
   - Click "Add app" → Web
   - Register app (name: "TMS Pro")
   - Click "Register app"
7. **Copy the `firebaseConfig` values**

### Step 3: Fill `.env` File

Create `.env` in project root with:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

**Replace with YOUR actual values from Firebase Console!**

### Step 4: Restart Dev Server

**CRITICAL**: After creating/updating `.env`:

1. **Stop the server**: Press `Ctrl+C` in terminal
2. **Start again**: `npm run dev`

**Vite only reads `.env` on startup, so restart is required!**

---

## 🔍 **Verify It Works**

After restarting, check the console:
- ✅ Should NOT see: "Firebase configuration is missing"
- ✅ Should NOT see: "auth/invalid-api-key"
- ✅ Should see: "Firebase App Check initialized successfully" (if App Check configured)

---

## 🆘 **Still Not Working?**

### Check 1: File Location
```bash
# Make sure .env is in project root
ls -la .env
# Should show: .env
```

### Check 2: Variable Names
- ✅ Must start with `VITE_`
- ✅ No spaces around `=`
- ✅ No quotes around values

### Check 3: Values
- ✅ API key should start with `AIzaSy`
- ✅ Project ID should match Firebase Console
- ✅ No extra spaces or newlines

### Check 4: Restart
- ✅ Did you restart the dev server after creating `.env`?

---

## 📝 **Example `.env` File**

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
VITE_FIREBASE_AUTH_DOMAIN=tms-pro-abc123.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tms-pro-abc123
VITE_FIREBASE_STORAGE_BUCKET=tms-pro-abc123.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef
```

---

## 🚀 **After Setup**

Once Firebase is configured:

1. **Enable Authentication**:
   - Firebase Console → Authentication → Get Started
   - Enable "Email/Password"

2. **Create Firestore**:
   - Firebase Console → Firestore Database → Create database
   - Start in "test mode"

3. **Create Admin User**:
   - Authentication → Users → Add user
   - Create Firestore doc: `users/{uid}` with `role: 'admin'`

---

**Need more help? See `FIREBASE_SETUP_INSTRUCTIONS.md`**


