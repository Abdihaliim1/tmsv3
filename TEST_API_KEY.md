# 🧪 Test API Key - Remove Restrictions Temporarily

## Current Status
- ✅ Application restrictions: "None" (good!)
- ✅ API restrictions: "Restrict key" with 24 APIs
- ❌ Still getting "API key not valid" error

**Let's test if removing API restrictions fixes it!**

---

## ✅ **Step 1: Temporarily Remove API Restrictions**

1. On the API key settings page (where you are now)
2. Under **"API restrictions"**:
   - Select **"Don't restrict key"** (instead of "Restrict key")
3. Click **"Save"** (bottom of page)
4. Wait 1-2 minutes for changes to propagate

---

## ✅ **Step 2: Test Login**

1. Go back to your app
2. **Hard refresh** the browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. Try logging in again
4. Check if the error is gone

---

## ✅ **Step 3: If It Works**

If login works after removing restrictions:

1. Go back to API key settings
2. Under **"API restrictions"**, select **"Restrict key"**
3. Click **"Select APIs"**
4. Make sure these are checked:
   - ✅ **Identity Toolkit API** (required for login)
   - ✅ **Cloud Firestore API** (required for database)
   - ✅ **Cloud Storage API** (required for file uploads)
   - ✅ **Firebase Installations API** (if available)
5. Click **"Save"**
6. Test login again

---

## 🔍 **If Still Not Working**

### Check 1: Verify API Key in .env
Make sure the API key in your `.env` file matches exactly:
- Current key: `AIzaSyA9zsiv0-Gxdon_-51H0q2Ct4TBE8L5YJc`
- Check Firebase Console → Project Settings → Your apps → Web
- Compare the `apiKey` value

### Check 2: Billing
- Some APIs require billing to be enabled
- Go to: Billing → Check if billing account is linked

### Check 3: Regenerate API Key
If nothing works, try creating a new API key:
1. Go to Credentials
2. Click **"+ Create credentials"** → **"API key"**
3. Copy the new key
4. Update `.env` file with new key
5. Restart dev server

---

## 🎯 **Quick Test Now**

**Right now, on the page you're viewing:**

1. Change **"API restrictions"** from **"Restrict key"** to **"Don't restrict key"**
2. Click **"Save"**
3. Wait 1-2 minutes
4. Try login again

This will tell us if the restrictions are the problem!

---

**Try this first - it's the quickest test!**


