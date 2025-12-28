import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { app } from "./firebase";

/**
 * Initialize Firebase App Check for rate limiting and abuse prevention
 * 
 * This helps protect against automated attacks and brute-force attempts.
 * Requires reCAPTCHA v3 site key in environment variables.
 * 
 * Call this once in main.tsx before rendering the app.
 */
export function initAppCheck() {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
  
  if (!recaptchaSiteKey) {
    // Only warn in development to reduce console noise in production
    if (import.meta.env.DEV) {
      console.warn('App Check not initialized: VITE_RECAPTCHA_V3_SITE_KEY not set. App Check is optional but recommended for production.');
    }
    return;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log('Firebase App Check initialized successfully');
  } catch (error) {
    console.error('Error initializing App Check:', error);
  }
}


