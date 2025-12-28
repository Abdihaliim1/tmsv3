# Firebase Setup Instructions - Fix Configuration Errors

## 🔴 **Current Error**

You're seeing these errors:
1. `Firebase configuration is missing. Please set environment variables.`
2. `FirebaseError: Firebase: Error (auth/invalid-api-key).`

This means your `.env` file is missing or incomplete.

---

## ✅ **Quick Fix Steps**

### Step 1: Create `.env` File

Create a `.env` file in the project root (`/Users/abdihaliimahmednurali/TMS-PRO-GOOGLE-/.env`)

### Step 2: Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll down to **"Your apps"** section
5. Click the **Web icon** (`</>`)
6. If you haven't registered a web app yet:
   - Click **"Add app"** → **Web**
   - Register app (nickname: "TMS Pro Web")
   - Click **"Register app"**
7. Copy the `firebaseConfig` object

### Step 3: Add to `.env` File

Create `.env` file with this content:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890

# Optional: reCAPTCHA v3 (for App Check)
VITE_RECAPTCHA_V3_SITE_KEY=your_recaptcha_site_key
```

**Replace the values** with your actual Firebase config values.

### Step 4: Restart Dev Server

After creating/updating `.env`:
1. Stop the dev server (Ctrl+C)
2. Start it again: `npm run dev`

---

## 📋 **Example `.env` File**

```env
# Firebase Configuration
# Get these from Firebase Console > Project Settings > Your apps > Web app

VITE_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
VITE_FIREBASE_AUTH_DOMAIN=tms-pro-12345.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tms-pro-12345
VITE_FIREBASE_STORAGE_BUCKET=tms-pro-12345.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef

# Optional: App Check (reCAPTCHA v3)
# Get from https://www.google.com/recaptcha/admin
VITE_RECAPTCHA_V3_SITE_KEY=6LcAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

---

## 🔍 **Verify Configuration**

After restarting, check the console:
- ✅ Should see: `Firebase App Check initialized successfully` (if App Check is configured)
- ❌ Should NOT see: `Firebase configuration is missing`
- ❌ Should NOT see: `auth/invalid-api-key`

---

## 🆘 **Troubleshooting**

### Error: "Firebase configuration is missing"
- ✅ Check `.env` file exists in project root
- ✅ Check all `VITE_FIREBASE_*` variables are set
- ✅ Restart dev server after creating `.env`

### Error: "auth/invalid-api-key"
- ✅ Verify API key is correct (no extra spaces)
- ✅ Check API key matches Firebase Console
- ✅ Ensure API key is from the correct project

### Still Not Working?
1. Check `.env` file is in the correct location (project root)
2. Verify variable names start with `VITE_` (required for Vite)
3. Make sure there are no quotes around values in `.env`
4. Restart dev server completely

---

## 📝 **Important Notes**

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Environment variables must start with `VITE_`** - This is required for Vite
3. **Restart required** - Changes to `.env` require dev server restart
4. **Case sensitive** - Variable names are case-sensitive

---

## 🚀 **Next Steps After Setup**

1. **Enable Authentication**:
   - Firebase Console → Authentication → Get Started
   - Enable "Email/Password" sign-in method

2. **Create Firestore Database**:
   - Firebase Console → Firestore Database → Create database
   - Start in "test mode" (we'll add rules later)

3. **Create First Admin User**:
   - Authentication → Users → Add user
   - Create user document in Firestore: `users/{uid}` with `role: 'admin'`

---

**END OF SETUP INSTRUCTIONS**


