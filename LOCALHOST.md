# 🚀 Localhost Development Setup

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The application will be available at:
- **Local**: http://localhost:2811
- **Network**: http://0.0.0.0:2811 (accessible from other devices on your network)

---

## Environment Variables (Optional)

If you need to use Gemini API features, create a `.env` file in the root directory:

```bash
# .env
GEMINI_API_KEY=your_api_key_here
```

---

## Available Scripts

### Development
```bash
npm run dev          # Start development server (port 2811)
```

### Build
```bash
npm run build        # Build for production
npm run preview      # Preview production build locally
```

### Code Quality
```bash
npm run lint         # Run ESLint
```

---

## Development Server Details

- **Port**: 2811
- **Host**: 0.0.0.0 (accessible from network)
- **Hot Module Replacement**: Enabled
- **Auto-reload**: Enabled

---

## Troubleshooting

### Port Already in Use
If port 2811 is already in use, you can:
1. Kill the process using port 2811:
   ```bash
   # macOS/Linux
   lsof -ti:2811 | xargs kill -9
   
   # Or find and kill manually
   lsof -i:2811
   ```

2. Or change the port in `vite.config.ts`:
   ```typescript
   server: {
     port: 2812,  // Change to any available port
     host: '0.0.0.0',
   }
   ```

### Firebase Connection Issues
- Ensure you have proper Firebase configuration
- Check browser console for Firebase errors
- Verify Firebase project settings

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Accessing from Mobile/Other Devices

Since the server is configured with `host: '0.0.0.0'`, you can access it from other devices:

1. Find your computer's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Or
   ipconfig getifaddr en0
   ```

2. Access from other device:
   ```
   http://YOUR_IP_ADDRESS:2811
   ```
   Example: `http://192.168.1.100:2811`

---

## Development Tips

1. **Hot Reload**: Changes to files automatically reload the browser
2. **Console Logs**: Check browser DevTools for debugging
3. **Network Tab**: Monitor API calls and Firebase requests
4. **React DevTools**: Install React DevTools browser extension for better debugging

---

## Next Steps

1. ✅ Start the dev server: `npm run dev`
2. ✅ Open http://localhost:2811 in your browser
3. ✅ Configure company settings in the Settings page
4. ✅ Start adding data (drivers, loads, etc.)

---

## Production Build

To test the production build locally:

```bash
npm run build
npm run preview
```

This will build and serve the production version at http://localhost:4173 (default Vite preview port).

