# 👤 Create Admin User in Firestore

## ✅ **Your User UID**
```
HpizRZ3WfgbdsYaMlrVHKmY6d4k2
```

---

## 📋 **Step-by-Step Instructions**

### Step 1: Go to Firestore Database

1. Open Firebase Console: https://console.firebase.google.com/
2. Select your project: **somtms-fec81**
3. Click **Firestore Database** (left sidebar)

### Step 2: Create Users Collection

1. If you see "Start collection" button, click it
2. If collection already exists, skip to Step 3

### Step 3: Create User Document

1. Click **"Start collection"** (or **"Add document"** if collection exists)
2. **Collection ID**: `users`
3. **Document ID**: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2` (paste your UID)
4. Click **"Next"**

### Step 4: Add Fields

Add these fields one by one:

| Field | Type | Value |
|-------|------|-------|
| `email` | **string** | (Your email address) |
| `displayName` | **string** | (Your name, e.g., "Admin User") |
| `role` | **string** | `admin` |
| `createdAt` | **timestamp** | Click timestamp icon (current time) |
| `updatedAt` | **timestamp** | Click timestamp icon (current time) |

**Important**: 
- `role` must be exactly: `admin` (lowercase)
- Use timestamp type for dates (click the clock icon)

### Step 5: Save

1. Click **"Save"**
2. You should see the document created in the `users` collection

---

## ✅ **Expected Result**

Your Firestore structure should look like:

```
Firestore Database
└── users (collection)
    └── HpizRZ3WfgbdsYaMlrVHKmY6d4k2 (document)
        ├── email: "your-email@example.com"
        ├── displayName: "Admin User"
        ├── role: "admin"
        ├── createdAt: [timestamp]
        └── updatedAt: [timestamp]
```

---

## 🧪 **Test It**

After creating the document:

1. Restart your dev server (if not already restarted)
2. Open the app in browser
3. Try logging in with your email and password
4. You should be able to log in and see the dashboard!

---

## 🆘 **Troubleshooting**

### Can't find "Start collection"?
- Make sure you're in **Firestore Database** (not Realtime Database)
- If you see "Create database", click it first

### Document already exists?
- That's okay! Just click on it and add/update the fields
- Make sure `role` is set to `admin`

### Still can't log in?
- Check the document ID matches exactly: `HpizRZ3WfgbdsYaMlrVHKmY6d4k2`
- Verify `role` field is exactly `admin` (lowercase, no spaces)
- Check browser console for any errors

---

**Once you create this document, you'll be able to log in as admin! 🎉**


