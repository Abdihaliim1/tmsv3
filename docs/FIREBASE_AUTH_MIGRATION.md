# Firebase Auth Migration - Implementation Guide

**Date**: 2025-01-27  
**Status**: ✅ **IMPLEMENTED**

---

## ✅ **COMPLETED CHANGES**

### 1. Firebase Configuration ✅

**File**: `src/lib/firebase.ts`

- Initialized Firebase App, Auth, Firestore, and Storage
- Uses environment variables for configuration
- Validates required config on load

**Environment Variables Required**:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

### 2. App Check for Rate Limiting ✅

**File**: `src/lib/appCheck.ts`

- Initializes Firebase App Check with reCAPTCHA v3
- Protects against automated attacks and brute-force attempts
- Auto-refreshes tokens
- Called in `main.tsx` before app renders

**Environment Variable Required**:
```env
VITE_RECAPTCHA_V3_SITE_KEY=your_recaptcha_site_key
```

**Note**: App Check is optional but highly recommended for production. The app will work without it, but will show a warning.

---

### 3. Firebase Auth Context ✅

**File**: `src/context/AuthContext.tsx`

**Removed**:
- ❌ Hardcoded `VALID_CREDENTIALS`
- ❌ localStorage for auth tokens
- ❌ Session storage in localStorage

**Added**:
- ✅ Firebase Auth integration
- ✅ Email/password authentication
- ✅ User role management via Firestore
- ✅ Password reset functionality
- ✅ User registration
- ✅ Real-time auth state listener

**Features**:
- `login(email, password)` - Sign in with email/password
- `logout()` - Sign out
- `register(email, password, displayName, role?)` - Create new account
- `resetPassword(email)` - Send password reset email
- `updateUserRole(uid, role)` - Update user role (admin function)

**User Role Storage**:
- Roles stored in Firestore: `users/{uid}`
- Default role: `'viewer'` (most restrictive)
- Roles: `'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer'`

---

### 4. Updated Login Page ✅

**File**: `src/pages/Login.tsx`

**Changes**:
- Changed from "username" to "email" field
- Added password visibility toggle
- Better error messages from Firebase Auth
- Improved UX with loading states

**Error Messages**:
- User-friendly error messages for common Firebase Auth errors
- Handles: user-not-found, wrong-password, invalid-email, too-many-requests, network errors

---

### 5. XSS Protection ✅

**File**: `src/security/sanitize.ts`

**Functions**:
- `sanitizeText(input)` - Removes all HTML, returns plain text
- `sanitizeHTML(input)` - Allows safe HTML tags only (use sparingly)
- `isValidEmail(email)` - Email validation
- `isValidURL(url)` - URL validation

**Usage**:
```typescript
import { sanitizeText } from '../security/sanitize';

// In forms/components
const safeNote = sanitizeText(userInput);
```

**Important**: 
- ✅ Never use `dangerouslySetInnerHTML` with user input
- ✅ Always sanitize user-entered text before saving/displaying
- ✅ Use `sanitizeText()` for notes, comments, descriptions

---

### 6. Removed Sensitive Data from localStorage ✅

**What Was Removed**:
- ❌ Auth tokens (now handled by Firebase Auth)
- ❌ User session data (now in Firebase Auth state)
- ❌ Password hashes (never stored, handled by Firebase)

**What's Still in localStorage** (Safe):
- ✅ UI preferences (theme, table columns)
- ✅ Non-sensitive cached filters
- ✅ Company profile (tenant-scoped, non-sensitive branding data)

**Note**: For production, consider migrating company profile to Firestore as well.

---

## 📋 **FIRESTORE SCHEMA**

### Users Collection

**Path**: `users/{uid}`

**Document Structure**:
```typescript
{
  email: string;
  displayName: string;
  role: 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';
  tenantId?: string;  // Optional: for multi-tenant support
  createdAt: string;  // ISO timestamp
  updatedAt: string;  // ISO timestamp
}
```

**Security Rules** (Recommended):
```javascript
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
```

---

## 🔧 **SETUP INSTRUCTIONS**

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Authentication → Email/Password
4. Enable Firestore Database
5. Enable Storage (if using logo uploads)

### Step 2: Get Firebase Config

1. Project Settings → General → Your apps → Web app
2. Copy the config object
3. Add to `.env` file:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 3: Set Up reCAPTCHA v3 (Optional but Recommended)

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Create a new site (reCAPTCHA v3)
3. Add your domain
4. Copy the Site Key
5. Add to `.env`:

```env
VITE_RECAPTCHA_V3_SITE_KEY=6Lc...
```

### Step 4: Create First Admin User

**Option A: Firebase Console**
1. Authentication → Users → Add user
2. Enter email/password
3. Manually create Firestore document:
   ```
   users/{uid}
   {
     email: "admin@example.com",
     displayName: "Admin User",
     role: "admin",
     createdAt: "2025-01-27T00:00:00.000Z",
     updatedAt: "2025-01-27T00:00:00.000Z"
   }
   ```

**Option B: Registration Flow**
1. Use the registration function in AuthContext
2. Update role manually in Firestore to 'admin'

---

## 🚨 **MIGRATION NOTES**

### Breaking Changes

1. **Login Method Changed**:
   - Old: Username/password (hardcoded)
   - New: Email/password (Firebase Auth)

2. **User Object Changed**:
   - Old: `{ username, name, role }`
   - New: `{ uid, email, displayName, role, tenantId? }`

3. **No More localStorage Auth**:
   - Auth state is now managed by Firebase
   - No manual session management needed

### Backward Compatibility

- ✅ RBAC system still works (uses `user.role`)
- ✅ All existing components work with new user object
- ✅ Display name falls back to email if not set

---

## 🔒 **SECURITY IMPROVEMENTS**

### ✅ Implemented

1. **Firebase Auth**: Industry-standard authentication
2. **App Check**: Rate limiting and abuse prevention
3. **XSS Protection**: DOMPurify sanitization
4. **No Sensitive Data in localStorage**: Removed auth tokens
5. **User-Friendly Error Messages**: Better UX for auth errors

### 📝 Recommended Next Steps

1. **Enable Firebase Security Rules**: Set up Firestore rules (see above)
2. **Enable Email Verification**: Require email verification for new users
3. **Add 2FA**: Consider adding two-factor authentication
4. **Audit Logging**: Log authentication events
5. **Session Management**: Configure session timeout if needed

---

## 🧪 **TESTING**

### Test Cases

1. **Login**:
   - ✅ Valid email/password → Success
   - ✅ Invalid email → Error message
   - ✅ Wrong password → Error message
   - ✅ Too many attempts → Rate limit message

2. **Logout**:
   - ✅ Sign out → Redirects to login
   - ✅ Auth state cleared

3. **Registration**:
   - ✅ New user → Creates account
   - ✅ Existing email → Error message
   - ✅ Weak password → Error message

4. **Password Reset**:
   - ✅ Valid email → Sends reset email
   - ✅ Invalid email → Error message

5. **XSS Protection**:
   - ✅ HTML in notes → Sanitized to plain text
   - ✅ Script tags → Removed

---

## 📚 **USAGE EXAMPLES**

### Using Auth in Components

```typescript
import { useAuth } from '../context/AuthContext';

const MyComponent = () => {
  const { user, isAuthenticated, logout } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }
  
  return (
    <div>
      <p>Welcome, {user?.displayName || user?.email}</p>
      <p>Role: {user?.role}</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
};
```

### Sanitizing User Input

```typescript
import { sanitizeText } from '../security/sanitize';

const handleNoteSubmit = (note: string) => {
  const safeNote = sanitizeText(note);
  // Save safeNote to database
};
```

---

## ⚠️ **IMPORTANT NOTES**

1. **Environment Variables**: Never commit `.env` file to git. Add to `.gitignore`.

2. **Firebase Rules**: Always set up Firestore security rules before production.

3. **App Check**: While optional, it's highly recommended for production to prevent abuse.

4. **User Roles**: Default role is 'viewer' (most restrictive). Admins must manually update roles in Firestore.

5. **Password Policy**: Firebase enforces minimum 6 characters. Consider adding stronger validation in UI.

---

**END OF MIGRATION GUIDE**


