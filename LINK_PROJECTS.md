# 🔗 Link Firebase to Existing Google Cloud Project

## The Situation
- **Firebase Project**: `somtms-fec81` (auto-created by Firebase)
- **Your Google Cloud Project**: `somtms` (your existing project)
- **Problem**: Firebase created its own Google Cloud project, but you want to use `somtms`

---

## ✅ **Solution: Find the Firebase-Created Google Cloud Project**

When Firebase creates a project, it automatically creates a Google Cloud project with the same ID.

### Step 1: Check if `somtms-fec81` Exists in Google Cloud

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Click the **project dropdown** at the top
3. Look for a project named **`somtms-fec81`**
4. If you see it, that's the one! Select it and continue to Step 2
5. If you DON'T see it, continue to Step 1b

### Step 1b: Check All Projects

1. In the project dropdown, click **"All"** or scroll to see all projects
2. Look for any project with ID containing `somtms-fec81` or `fec81`
3. Firebase might have created it with a slightly different name

---

## ✅ **Solution 2: Enable APIs in Firebase-Created Project**

Once you find the `somtms-fec81` project in Google Cloud:

1. **Select that project** in Google Cloud Console
2. Go to **"APIs & Services"** → **"Library"**
3. Enable these APIs:
   - ✅ **Identity Toolkit API**
   - ✅ **Cloud Firestore API**
   - ✅ **Cloud Storage API**
4. Wait 1-2 minutes
5. Try login again

---

## ✅ **Solution 3: Use Your Existing `somtms` Project (Advanced)**

**⚠️ This is more complex and may require recreating the Firebase project**

If you really want to use your existing `somtms` Google Cloud project:

### Option A: Create New Firebase Project Linked to `somtms`

1. Go to Firebase Console
2. Click **"Add project"**
3. **Project name**: `somtms` (or whatever you want)
4. **Important**: When asked about Google Analytics, you'll see an option to select an existing Google Cloud project
5. Select your existing **`somtms`** Google Cloud project
6. This will link Firebase to your existing Google Cloud project
7. **⚠️ Note**: You'll need to update your `.env` file with the new Firebase config

### Option B: Keep Current Setup (Recommended)

**Easier approach**: Just use the Google Cloud project that Firebase created (`somtms-fec81`)

1. Find it in Google Cloud Console
2. Enable the APIs there
3. Everything will work!

---

## 🎯 **Recommended: Use Firebase-Created Project**

**Why?**
- Firebase and Google Cloud projects are already linked
- No need to reconfigure
- Just enable APIs and you're done

**Steps:**
1. Find `somtms-fec81` in Google Cloud Console
2. Enable APIs
3. Done!

---

## 🔍 **How to Find the Project**

### In Google Cloud Console:

1. Click project dropdown (top)
2. Look for projects starting with `somtms-fec81`
3. If you see many projects, use the search box
4. Search for: `fec81` or `somtms-fec81`

### Check Project Number:

From your Firebase settings, I can see:
- **Project number**: `195887465924`

You can also search by this number in Google Cloud Console.

---

## ✅ **Quick Action Plan**

1. **Go to Google Cloud Console**
2. **Click project dropdown**
3. **Search for**: `somtms-fec81` or `195887465924`
4. **Select that project**
5. **Enable APIs**: Identity Toolkit, Firestore, Storage
6. **Wait 1-2 minutes**
7. **Try login again**

---

**The key: Firebase created a Google Cloud project automatically. Find it and enable APIs there!**


