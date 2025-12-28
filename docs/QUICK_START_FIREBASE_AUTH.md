# Quick Start: Firebase Auth Setup

## 🚀 **5-Minute Setup**

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "TMS-Pro")
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Services

**Authentication**:
1. Go to Authentication → Get Started
2. Enable "Email/Password" sign-in method
3. Click "Save"

**Firestore**:
1. Go to Firestore Database → Create database
2. Start in "test mode" (we'll add rules later)
3. Choose location (closest to your users)
4. Click "Enable"

**Storage** (Optional, for logo uploads):
1. Go to Storage → Get Started
2. Start in "test mode"
3. Click "Next" → "Done"

### Step 3: Get Configuration

1. Go to Project Settings (gear icon) → General
2. Scroll to "Your apps" → Web app icon (`</>`)
3. Register app (nickname: "TMS Pro Web")
4. Copy the `firebaseConfig` object

### Step 4: Create .env File

Create `.env` in project root:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 5: Create First Admin User

**Option A: Firebase Console**
1. Authentication → Users → Add user
2. Email: `admin@yourcompany.com`
3. Password: (set a strong password)
4. Click "Add user"
5. Copy the User UID

**Option B: Use Registration Flow**
1. Run the app
2. Use registration function (if implemented)
3. Manually update role in Firestore

### Step 6: Set User Role in Firestore

1. Go to Firestore Database
2. Create collection: `users`
3. Create document with ID = User UID (from Step 5)
4. Add fields:
   ```json
   {
     "email": "admin@yourcompany.com",
     "displayName": "Admin User",
     "role": "admin",
     "createdAt": "2025-01-27T00:00:00.000Z",
     "updatedAt": "2025-01-27T00:00:00.000Z"
   }
   ```

### Step 7: Set Firestore Security Rules

1. Go to Firestore Database → Rules
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read their own document
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Only admins can write user documents
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // Users can update their own displayName
      allow update: if request.auth != null && 
        request.auth.uid == userId &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'updatedAt']);
    }
    
    // Add other collections as needed
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

### Step 8: Test Login

1. Run the app: `npm run dev`
2. Go to login page
3. Enter admin email and password
4. Should successfully log in and see dashboard

---

## 🔐 **Optional: App Check Setup** (Recommended)

### Step 1: Get reCAPTCHA v3 Site Key

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Click "+" to create new site
3. Label: "TMS Pro"
4. reCAPTCHA type: **v3**
5. Domains: Add your domain (e.g., `localhost`, `yourdomain.com`)
6. Accept terms → Submit
7. Copy the **Site Key**

### Step 2: Add to .env

```env
VITE_RECAPTCHA_V3_SITE_KEY=6Lc...
```

### Step 3: Verify

1. Restart dev server
2. Check browser console - should see: "Firebase App Check initialized successfully"

---

## ✅ **Verification Checklist**

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] `.env` file created with all variables
- [ ] First admin user created
- [ ] User role set in Firestore (`users/{uid}`)
- [ ] Firestore security rules set
- [ ] Login works with admin credentials
- [ ] App Check initialized (if configured)

---

## 🆘 **Troubleshooting**

### "Firebase configuration is missing"
- Check `.env` file exists
- Verify all `VITE_FIREBASE_*` variables are set
- Restart dev server after adding `.env`

### "User not found" or "Wrong password"
- Verify user exists in Firebase Console → Authentication
- Check email spelling
- Try resetting password

### "Access Denied" after login
- Check user document exists in Firestore: `users/{uid}`
- Verify `role` field is set (default: 'viewer')
- Update role to 'admin' if needed

### App Check not working
- Verify `VITE_RECAPTCHA_V3_SITE_KEY` is set
- Check domain is added in reCAPTCHA admin
- App Check is optional - app works without it

---

## 📚 **Next Steps**

1. **Create More Users**: Add users via Firebase Console or registration flow
2. **Set Roles**: Update roles in Firestore as needed
3. **Enable Email Verification**: Require email verification for new users
4. **Add 2FA**: Consider two-factor authentication
5. **Monitor**: Check Firebase Console → Authentication → Users for activity

---

**END OF QUICK START GUIDE**


