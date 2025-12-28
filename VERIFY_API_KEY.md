# 🔍 Verify API Key - Still Not Working

## Current Status
- ✅ Restrictions removed
- ✅ APIs enabled
- ❌ Still getting "API key not valid" error

**The API key itself might be the issue!**

---

## ✅ **Step 1: Verify API Key Matches**

### Check Firebase Console:
1. Go to Firebase Console: https://console.firebase.google.com/
2. Project: **somtms-fec81**
3. ⚙️ → **Project Settings**
4. Scroll to **"Your apps"** → Click **Web app** (`sometms`)
5. Look at the `firebaseConfig` object
6. **Copy the `apiKey` value**

### Check .env File:
1. Open `.env` file in project root
2. Find `VITE_FIREBASE_API_KEY=`
3. Compare with Firebase Console value

**They must match exactly!**

---

## ✅ **Step 2: Get the Correct API Key**

### Option A: Copy from Firebase Console
1. Firebase Console → Project Settings → Your apps → Web
2. Copy the `apiKey` from `firebaseConfig`
3. Update `.env` file
4. Restart dev server

### Option B: Show Key in Google Cloud
1. Google Cloud Console → APIs & Services → Credentials
2. Click on "Browser key (auto created by Firebase)"
3. Click **"Show key"** button
4. Copy the key
5. Update `.env` file
6. Restart dev server

---

## ✅ **Step 3: Check Billing**

Some APIs require billing to be enabled:

1. Go to Google Cloud Console
2. Project: **somtms-fec81**
3. Go to **"Billing"** (left menu)
4. Check if billing account is linked
5. If not, link a billing account

**⚠️ Note**: Even with billing, you get free tier usage. This is just to enable the APIs.

---

## ✅ **Step 4: Regenerate API Key (If Needed)**

If the key still doesn't work:

1. Google Cloud Console → APIs & Services → Credentials
2. Find "Browser key (auto created by Firebase)"
3. Click **"Delete"** (or create a new one)
4. Go to Firebase Console → Project Settings
5. The key should auto-regenerate
6. Copy the new key
7. Update `.env` file
8. Restart dev server

---

## ✅ **Step 5: Verify Project Selection**

Make sure you're working in the correct project:

1. Google Cloud Console → Check project dropdown (top)
2. Should show: **somtms-fec81**
3. Not: `somtms` (different project)

---

## 🔍 **Quick Checklist**

- [ ] API key in `.env` matches Firebase Console exactly
- [ ] Billing is enabled for the project
- [ ] Working in correct project: `somtms-fec81`
- [ ] Dev server restarted after updating `.env`
- [ ] Hard refreshed browser (Ctrl+Shift+R)

---

## 🆘 **Last Resort: Create New API Key**

If nothing works:

1. **Google Cloud Console** → APIs & Services → Credentials
2. Click **"+ Create credentials"** → **"API key"**
3. Copy the new key immediately
4. Update `.env`:
   ```env
   VITE_FIREBASE_API_KEY=new_key_here
   ```
5. **Restart dev server**: `npm run dev`
6. Try login again

---

**Most likely: API key in .env doesn't match Firebase Console, or billing needs to be enabled!**


