# 🔴 Fix: Project Name Mismatch

## The Issue
- **Firebase Project**: `somtms-fec81`
- **Google Cloud Project**: `somtms`
- **Problem**: These don't match!

Firebase projects are linked to Google Cloud projects. The API key needs to be from the **same Google Cloud project** that your Firebase project uses.

---

## ✅ **Solution 1: Find the Correct Google Cloud Project**

### Step 1: Check Firebase Project's Google Cloud Project

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select project: **somtms-fec81**
3. Click **⚙️ (gear icon)** → **Project Settings**
4. Scroll to **"Your project"** section
5. Look for **"Project ID"** or **"Google Cloud Platform (GCP) project"**
6. Note the **Google Cloud Project ID** (might be `somtms-fec81` or something else)

### Step 2: Switch to Correct Google Cloud Project

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. At the top, click the **project dropdown** (shows "somtms")
3. Look for the project that matches your Firebase project
4. If you see `somtms-fec81`, select it
5. If you don't see it, continue to Solution 2

---

## ✅ **Solution 2: Use the Correct Project in Google Cloud**

### Option A: Use `somtms-fec81` Project

1. In Google Cloud Console, click the **project dropdown** at the top
2. Click **"New Project"**
3. **Project name**: `somtms-fec81`
4. Click **"Create"**
5. Wait for it to be created
6. Select this new project

### Option B: Link Firebase to Existing `somtms` Project

**⚠️ This is more complex and may require Firebase support**

1. Firebase projects are usually auto-linked to Google Cloud projects
2. You might need to:
   - Create a new Firebase project linked to `somtms`
   - OR use the Google Cloud project that Firebase created

---

## ✅ **Solution 3: Enable APIs in the Correct Project**

Once you're in the **correct Google Cloud project**:

1. Go to **"APIs & Services"** → **"Library"**
2. Search and enable:
   - ✅ **Identity Toolkit API**
   - ✅ **Cloud Firestore API**
   - ✅ **Cloud Storage API**

---

## 🔍 **Quick Check: What Project is Firebase Using?**

### Check in Firebase Console:

1. Firebase Console → Project Settings
2. Look for **"Project ID"** or **"Google Cloud Platform"**
3. This tells you which Google Cloud project to use

### Check in Google Cloud Console:

1. Look at the project dropdown
2. See if there's a project that matches your Firebase project ID
3. That's the one you need to use!

---

## 🎯 **Recommended Approach**

**Easiest**: Use the Google Cloud project that Firebase automatically created.

1. In Google Cloud Console, look for a project with ID similar to `somtms-fec81`
2. If it exists, select it
3. Enable the APIs there
4. The API key should work

**If that project doesn't exist**, Firebase might have created it with a different name. Check Firebase Console → Project Settings to find the exact Google Cloud project ID.

---

**The key is: Firebase project and Google Cloud project must match (or be linked)!**


