# 🔧 Fix API Key Restrictions

## ✅ **Current Status**
- ✅ Project found: `somtms-fec81`
- ✅ APIs enabled: Identity Toolkit, Firestore, Storage
- ❌ Still getting "API key not valid" error

**The issue is likely API key restrictions!**

---

## 🔧 **Step 1: Go to API Key Settings**

1. In Google Cloud Console (project: `somtms-fec81`)
2. Go to **"APIs & Services"** → **"Credentials"**
3. Find your API key: `AIzaSyA9zsiv0-Gxdon_-51H0q2Ct4TBE8L5YJc`
4. **Click on it** to edit

---

## 🔧 **Step 2: Check Application Restrictions**

Look for **"Application restrictions"** section:

### Option A: Remove Restrictions (Quick Test)

1. Under **"Application restrictions"**, select **"None"**
2. Click **"Save"**
3. Wait 1-2 minutes
4. Try login again

**⚠️ Warning**: This makes the key public. Only for testing!

### Option B: Set Correct Restrictions (Recommended)

1. Under **"Application restrictions"**, select **"HTTP referrers (web sites)"**
2. Click **"Add an item"**
3. Add these referrers (one per line):
   ```
   localhost:*
   127.0.0.1:*
   http://localhost:*
   http://127.0.0.1:*
   https://localhost:*
   ```
4. If you have a production domain, add it too
5. Click **"Save"**

---

## 🔧 **Step 3: Check API Restrictions**

Look for **"API restrictions"** section:

### Option A: Remove Restrictions (Quick Test)

1. Under **"API restrictions"**, select **"Don't restrict key"**
2. Click **"Save"**
3. Wait 1-2 minutes
4. Try login again

### Option B: Set Correct Restrictions (Recommended)

1. Under **"API restrictions"**, select **"Restrict key"**
2. Click **"Select APIs"**
3. Make sure these are checked:
   - ✅ **Identity Toolkit API**
   - ✅ **Cloud Firestore API**
   - ✅ **Cloud Storage API**
   - ✅ **Firebase Installations API** (if available)
4. Click **"Save"**

---

## 🔧 **Step 4: Save and Wait**

1. Click **"Save"** at the bottom
2. **Wait 1-2 minutes** for changes to propagate
3. **Refresh your browser** (hard refresh: Ctrl+Shift+R)
4. **Try logging in again**

---

## 🧪 **Quick Test: Remove All Restrictions**

For quick testing, you can temporarily:

1. **Application restrictions**: Select **"None"**
2. **API restrictions**: Select **"Don't restrict key"**
3. Click **"Save"**
4. Wait 1-2 minutes
5. Try login

**⚠️ Remember to add restrictions back after testing!**

---

## 🔍 **Other Things to Check**

### Check Billing
- Make sure billing is enabled for the project
- Some APIs require billing to be enabled

### Check API Key is Correct
- Verify the API key in `.env` matches Firebase Console
- Go to Firebase Console → Project Settings → Your apps → Web
- Compare the `apiKey` value

### Check Project is Selected
- Make sure you're working in project: `somtms-fec81`
- Not the `somtms` project

---

## ✅ **Most Likely Fix**

**Remove API restrictions temporarily** to test:

1. APIs & Services → Credentials
2. Click on your API key
3. **API restrictions**: Select **"Don't restrict key"**
4. **Application restrictions**: Select **"None"** (for testing)
5. Save
6. Wait 1-2 minutes
7. Try login

If it works, then add back the restrictions properly.

---

**The API key restrictions are likely blocking the requests!**


