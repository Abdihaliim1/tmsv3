# Troubleshooting Guide

## Server Not Connecting to localhost:3000

### ✅ Server Status Check

The development server IS running. To verify:

```bash
# Check if server is running
lsof -ti:3000

# Or check the process
ps aux | grep vite
```

### 🔧 Common Solutions

#### 1. **Hard Refresh Your Browser**
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Safari**: `Cmd+Option+R`

#### 2. **Clear Browser Cache**
- Open Developer Tools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"

#### 3. **Check the Correct URL**
Make sure you're accessing:
```
http://localhost:3000
```
NOT:
- `https://localhost:3000` (wrong protocol)
- `localhost:3000` (missing http://)
- `127.0.0.1:3000` (should work, but try localhost first)

#### 4. **Check Browser Console for Errors**
1. Open Developer Tools (F12 or Cmd+Option+I)
2. Go to the "Console" tab
3. Look for any red error messages
4. Share the errors if you see any

#### 5. **Restart the Development Server**

If the server isn't responding:

```bash
# Stop any running server
pkill -f vite

# Start fresh
npm run dev
```

Wait for the message:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

#### 6. **Check Firewall/Antivirus**
- Some firewalls block localhost connections
- Temporarily disable to test
- Add an exception for Node.js if needed

#### 7. **Try a Different Browser**
- Test in Chrome, Firefox, or Safari
- Some browsers have stricter security policies

#### 8. **Check Port Availability**

If port 3000 is in use:

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process if needed
kill -9 <PID>
```

Or change the port in `vite.config.ts`:
```typescript
server: {
  port: 3001, // Change to different port
}
```

### 🐛 Debug Steps

1. **Verify server is running:**
   ```bash
   curl http://localhost:3000
   ```
   Should return HTML content

2. **Check for JavaScript errors:**
   - Open browser console (F12)
   - Look for import/module errors
   - Check Network tab for failed requests

3. **Verify file structure:**
   - `index.html` should be in root
   - `src/main.tsx` should exist
   - All imports should be correct

### 📞 Still Not Working?

If none of the above works:

1. **Share the browser console errors**
2. **Check if you can access:** `http://127.0.0.1:3000`
3. **Try a different port:** Change to 3001 or 5173
4. **Verify Node.js version:** Should be 18+
   ```bash
   node --version
   ```

### ✅ Expected Behavior

When working correctly:
- Browser should show "ATS FREIGHT LLC - TMS Pro" in the title
- You should see the dashboard with KPIs
- No errors in browser console
- Network tab shows successful requests

