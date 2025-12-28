# 🔴 Fix: API Key Not Valid Error

## Current Error
```
API key not valid. Please pass a valid API key.
auth/api-key-not-valid
```

**Your API Key**: `AIzaSyA9zsiv0-Gxdon_-51H0q2Ct4TBE8L5YJc`

---

## ✅ **Solution: Enable APIs & Configure API Key**

The API key exists but needs to have the right APIs enabled and restrictions configured.

---

## 🔧 **Step 1: Go to Google Cloud Console**

1. Go to: https://console.cloud.google.com/
2. Select project: **somtms-fec81**
3. If you don't see it, make sure you're logged in with the same Google account

---

## 🔧 **Step 2: Enable Required APIs**

1. In Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for and **enable** these APIs:
   - ✅ **Identity Toolkit API** (required for Authentication)
   - ✅ **Cloud Firestore API** (required for Firestore)
   - ✅ **Cloud Storage API** (required for Storage)

### Enable Identity Toolkit API:
1. Search: "Identity Toolkit API"
2. Click on it
3. Click **"Enable"** button

### Enable Cloud Firestore API:
1. Search: "Cloud Firestore API"
2. Click on it
3. Click **"Enable"** button

### Enable Cloud Storage API:
1. Search: "Cloud Storage API"
2. Click on it
3. Click **"Enable"** button

---

## 🔧 **Step 3: Configure API Key Restrictions**

1. Go to **"APIs & Services"** → **"Credentials"**
2. Find your API key: `AIzaSyA9zsiv0-Gxdon_-51H0q2Ct4TBE8L5YJc`
3. Click on it to edit

### Set Application Restrictions:
- **Application restrictions**: Select **"HTTP referrers (web sites)"**
- **Website restrictions**: Click **"Add an item"**
- Add: `localhost:*` (for development)
- Add: `127.0.0.1:*` (for development)
- Add your production domain if you have one

### Set API Restrictions:
- **API restrictions**: Select **"Restrict key"**
- **Select APIs**: Check these:
  - ✅ Identity Toolkit API
  - ✅ Cloud Firestore API
  - ✅ Cloud Storage API
  - ✅ Firebase Installations API (if available)

4. Click **"Save"**

---

## 🔧 **Alternative: Remove Restrictions (Development Only)**

**⚠️ Only for development/testing!**

If you want to quickly test, you can temporarily remove all restrictions:

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click on your API key
3. Under **"Application restrictions"**: Select **"None"**
4. Under **"API restrictions"**: Select **"Don't restrict key"**
5. Click **"Save"**

**⚠️ Warning**: This makes your API key public. Only use for development!

---

## ✅ **Step 4: Wait & Test**

1. **Wait 1-2 minutes** for changes to propagate
2. **Refresh your browser** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
3. **Try logging in again**

---

## 🧪 **Verify APIs Are Enabled**

Check that these show as "Enabled":
- Identity Toolkit API
- Cloud Firestore API
- Cloud Storage API

---

## 🆘 **Still Not Working?**

### Check 1: API Key Matches
- Verify the API key in `.env` matches Firebase Console
- Go to Firebase Console → Project Settings → Your apps → Web
- Compare the `apiKey` value

### Check 2: Project Matches
- Make sure Google Cloud project matches Firebase project
- Both should be: **somtms-fec81**

### Check 3: Wait Time
- API changes can take 1-5 minutes to propagate
- Try again after waiting

---

**Most likely fix: Enable Identity Toolkit API in Google Cloud Console!**


