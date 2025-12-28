# 🔧 Localhost Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Cannot GET /" or Blank Page

**Symptoms:**
- Browser shows blank page or "Cannot GET /" error
- Console shows 404 errors

**Solution:**
1. Make sure you're accessing the correct URL:
   ```
   http://localhost:2811
   ```
   NOT `http://localhost:2811/src` or any subdirectory

2. Check if the dev server is actually running:
   ```bash
   lsof -i:2811
   ```
   You should see a `node` process listening on port 2811

3. Restart the dev server:
   ```bash
   # Kill any existing process
   pkill -f vite
   
   # Start fresh
   npm run dev
   ```

---

### Issue 2: Port Already in Use

**Symptoms:**
- Error: "Port 2811 is already in use"
- Server won't start

**Solution:**
```bash
# Find and kill the process
lsof -ti:2811 | xargs kill -9

# Or use the script
./start-localhost.sh
```

---

### Issue 3: Module Not Found Errors

**Symptoms:**
- Console shows "Cannot find module" errors
- Build fails with import errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

### Issue 4: TypeScript Errors

**Symptoms:**
- Build fails with TypeScript errors
- Red squiggly lines in IDE

**Solution:**
```bash
# Check for TypeScript errors
npm run build

# If errors persist, check tsconfig.json
cat tsconfig.json
```

---

### Issue 5: Browser Shows "Loading..." Forever

**Symptoms:**
- Page loads but shows loading spinner
- No data appears

**Solution:**
1. Open browser DevTools (F12)
2. Check Console tab for JavaScript errors
3. Check Network tab for failed requests
4. Clear browser cache and localStorage:
   ```javascript
   // In browser console:
   localStorage.clear();
   location.reload();
   ```

---

### Issue 6: CORS Errors

**Symptoms:**
- Console shows CORS policy errors
- API requests fail

**Solution:**
This shouldn't happen with Vite dev server, but if it does:
1. Check `vite.config.ts` - `host: '0.0.0.0'` should be set
2. Make sure you're accessing via `localhost`, not `127.0.0.1` or IP address

---

### Issue 7: Hot Reload Not Working

**Symptoms:**
- Changes don't reflect automatically
- Need to manually refresh

**Solution:**
1. Check if HMR (Hot Module Replacement) is enabled in Vite
2. Try hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Restart dev server

---

## Step-by-Step Diagnostic

### Step 1: Verify Dependencies
```bash
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 8.0.0
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Check for Build Errors
```bash
npm run build
```
If this fails, fix the errors first.

### Step 4: Start Dev Server
```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:2811/
  ➜  Network: http://0.0.0.0:2811/
```

### Step 5: Open Browser
1. Open http://localhost:2811
2. Open DevTools (F12)
3. Check Console for errors
4. Check Network tab for failed requests

---

## Quick Fixes

### Complete Reset
```bash
# Stop all processes
pkill -f vite
pkill -f node

# Clean install
rm -rf node_modules package-lock.json
npm install

# Start fresh
npm run dev
```

### Check What's Running
```bash
# See all node processes
ps aux | grep node

# See what's using port 2811
lsof -i:2811
```

### Clear Browser Data
1. Open DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Clear Local Storage
4. Clear Session Storage
5. Hard refresh: `Cmd+Shift+R` or `Ctrl+Shift+R`

---

## Still Not Working?

1. **Check the terminal output** - Look for error messages when starting `npm run dev`
2. **Check browser console** - Press F12 and look at Console tab
3. **Try a different browser** - Sometimes browser extensions cause issues
4. **Try incognito/private mode** - Rules out browser extensions
5. **Check firewall/antivirus** - May be blocking localhost connections

---

## Expected Behavior

When working correctly:
- ✅ Terminal shows: `Local: http://localhost:2811/`
- ✅ Browser loads the TMS dashboard
- ✅ No errors in browser console
- ✅ Hot reload works (changes reflect automatically)

---

## Get Help

If none of these solutions work:
1. Copy the exact error message from terminal
2. Copy the error from browser console (F12)
3. Note what you were doing when it broke
4. Check if it worked before and what changed

