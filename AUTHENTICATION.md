# 🔐 Authentication System

## Overview

The TMS Pro application now includes a username/password authentication system that protects all routes and requires users to log in before accessing the application.

---

## Login Credentials

**Username:** `Abdihaliim`  
**Password:** `Abdi1234`

> **Note:** Username is case-insensitive, password is case-sensitive.

---

## Features

### ✅ Authentication Features
- **Login Page** - Beautiful, responsive login interface
- **Session Persistence** - Login state saved in localStorage
- **Route Protection** - All pages require authentication
- **Logout Functionality** - Sign out button in header
- **User Display** - Shows logged-in user name in header

### 🔒 Security
- Password validation on login
- Session stored securely in browser localStorage
- Automatic logout on session expiration (if implemented)
- Protected routes - cannot access app without login

---

## How It Works

### 1. Login Flow
1. User visits the application
2. If not authenticated, Login page is shown
3. User enters username and password
4. Credentials are validated
5. On success, user is redirected to Dashboard
6. Session is saved in localStorage

### 2. Session Management
- Login state is stored in `localStorage` with key `tms_auth_user`
- Session persists across browser refreshes
- User remains logged in until they click "Sign Out"

### 3. Route Protection
- All application routes are protected
- Unauthenticated users are automatically redirected to Login
- Authenticated users can access all pages

---

## Components

### `AuthContext` (`src/context/AuthContext.tsx`)
- Manages authentication state
- Provides `login()`, `logout()`, and `isAuthenticated` functions
- Handles session persistence

### `Login` Page (`src/pages/Login.tsx`)
- Login form with username and password fields
- Error handling and validation
- Loading states during authentication
- Responsive design

### `Header` Component (`src/components/Header.tsx`)
- Displays logged-in user name
- User menu dropdown with logout option
- Shows user avatar

---

## Usage

### For Users

1. **Login:**
   - Open the application
   - Enter username: `Abdihaliim`
   - Enter password: `Abdi1234`
   - Click "Sign In"

2. **Logout:**
   - Click on your user avatar in the top-right corner
   - Click "Sign Out" from the dropdown menu

### For Developers

#### Accessing Auth State
```typescript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Check if user is logged in
  if (isAuthenticated) {
    console.log('User:', user?.name);
  }
}
```

#### Adding Protected Routes
Routes are automatically protected. The `App.tsx` component checks authentication and shows Login if not authenticated.

---

## File Structure

```
src/
├── context/
│   └── AuthContext.tsx      # Authentication context and provider
├── pages/
│   └── Login.tsx            # Login page component
├── components/
│   └── Header.tsx           # Updated with user menu and logout
└── App.tsx                  # Updated with authentication check
```

---

## Customization

### Adding More Users

To add more users, edit `src/context/AuthContext.tsx`:

```typescript
const VALID_CREDENTIALS = [
  {
    username: 'Abdihaliim',
    password: 'Abdi1234',
    name: 'Abdihaliim'
  },
  {
    username: 'NewUser',
    password: 'NewPassword123',
    name: 'New User'
  }
];
```

Then update the `login` function to check against the array.

### Changing Session Storage

To use sessionStorage instead of localStorage, change in `AuthContext.tsx`:

```typescript
// Change from:
localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));

// To:
sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
```

---

## Testing

### Test Login
1. Start the dev server: `npm run dev`
2. Open http://localhost:2811
3. You should see the Login page
4. Enter credentials and click "Sign In"
5. You should be redirected to Dashboard

### Test Logout
1. While logged in, click user avatar in header
2. Click "Sign Out"
3. You should be redirected back to Login page

### Test Session Persistence
1. Log in
2. Refresh the page (F5)
3. You should remain logged in
4. Close and reopen browser
5. You should still be logged in (localStorage persists)

---

## Security Notes

⚠️ **Current Implementation:**
- Credentials are hardcoded in the frontend (not secure for production)
- Suitable for development and single-user scenarios

🔒 **For Production:**
- Move authentication to backend API
- Use JWT tokens or session-based auth
- Hash passwords (never store plain text)
- Implement proper user database
- Add rate limiting for login attempts
- Use HTTPS only

---

## Troubleshooting

### "Invalid username or password"
- Check username is exactly: `Abdihaliim` (case-insensitive)
- Check password is exactly: `Abdi1234` (case-sensitive)
- Check for extra spaces in input fields

### Login page not showing
- Clear browser localStorage
- Check browser console for errors
- Verify AuthProvider is wrapping App component

### Can't logout
- Check browser console for errors
- Try clearing localStorage manually:
  ```javascript
  localStorage.removeItem('tms_auth_user');
  location.reload();
  ```

---

## Status

✅ **Authentication system is fully implemented and working!**

- Login page created
- Credentials configured (Abdihaliim / Abdi1234)
- Route protection enabled
- Logout functionality added
- Session persistence working

