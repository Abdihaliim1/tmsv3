# 🚀 Setup Firebase - Step by Step

## ✅ **Step 1: Get Your Firebase Config**

### A. Go to Firebase Console
👉 **https://console.firebase.google.com/**

### B. Create or Select Project
- If you don't have a project: Click "Add project" → Enter name → Continue
- If you have a project: Select it from the list

### C. Get Web App Config
1. Click the **⚙️ gear icon** (top left) → **Project Settings**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** (`</>`)
4. If you see "Add app" button:
   - Click **"Add app"** → **Web**
   - Register app name: **"TMS Pro"**
   - Click **"Register app"**
5. You'll see a `firebaseConfig` object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### D. Copy Values to `.env`
Open `.env` file in the project root and replace the placeholders:

```env
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

---

## ✅ **Step 2: Enable Firebase Services**

### Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Click **"Email/Password"**
5. Toggle **"Enable"** → Click **"Save"**

### Create Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click **"Create database"**
3. Select **"Start in test mode"** (we'll add rules later)
4. Choose a location (closest to your users)
5. Click **"Enable"**

### Enable Storage (Optional, for document uploads)
1. In Firebase Console, go to **Storage**
2. Click **"Get started"**
3. Select **"Start in test mode"**
4. Click **"Next"** → **"Done"**

---

## ✅ **Step 3: Create First Admin User**

### Option A: Via Firebase Console
1. Go to **Authentication** → **Users**
2. Click **"Add user"**
3. Enter email: `admin@yourcompany.com`
4. Enter password (strong password)
5. Click **"Add user"**
6. **Copy the User UID** (you'll need it)

### Option B: Via Registration (if implemented)
- Use the registration flow in the app
- Then manually update role in Firestore

### Set User Role in Firestore
1. Go to **Firestore Database**
2. Click **"Start collection"**
3. Collection ID: `users`
4. Document ID: **Paste the User UID** (from step above)
5. Add fields:
   - `email` (string): `admin@yourcompany.com`
   - `displayName` (string): `Admin User`
   - `role` (string): `admin`
   - `createdAt` (timestamp): Click timestamp icon
   - `updatedAt` (timestamp): Click timestamp icon
6. Click **"Save"**

---

## ✅ **Step 4: Update `.env` File**

Open `.env` and replace all `REPLACE_WITH_*` values with your actual Firebase config.

**Example:**
```env
VITE_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
VITE_FIREBASE_AUTH_DOMAIN=tms-pro-abc123.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tms-pro-abc123
VITE_FIREBASE_STORAGE_BUCKET=tms-pro-abc123.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef
```

---

## ✅ **Step 5: Restart Dev Server**

**CRITICAL**: After updating `.env`:

1. **Stop the server**: Press `Ctrl+C` in terminal
2. **Start again**: 
   ```bash
   npm run dev
   ```

---

## ✅ **Step 6: Test Login**

1. Open the app in browser
2. You should see the login page
3. Try logging in with:
   - Email: `admin@yourcompany.com` (or the email you created)
   - Password: (the password you set)

---

## 🎉 **You're Done!**

If everything is set up correctly:
- ✅ No Firebase errors in console
- ✅ Login page appears
- ✅ Can log in with admin credentials
- ✅ Dashboard loads after login

---

## 🆘 **Troubleshooting**

### Still seeing "Firebase configuration is missing"?
- ✅ Check `.env` file exists in project root
- ✅ Check all values are filled (no `REPLACE_WITH_*` left)
- ✅ Restart dev server after updating `.env`

### Still seeing "auth/invalid-api-key"?
- ✅ Verify API key is correct (starts with `AIzaSy`)
- ✅ Check for extra spaces in `.env` file
- ✅ Make sure values match Firebase Console exactly

### Can't log in?
- ✅ Check user exists in Authentication → Users
- ✅ Check user document exists in Firestore → `users` collection
- ✅ Verify `role` field is set to `admin`

---

**Need help? Check `FIREBASE_SETUP_INSTRUCTIONS.md` for more details.**


