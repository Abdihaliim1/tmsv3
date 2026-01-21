import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Required Firebase config keys
const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId'] as const;

// Validate required config
const missingKeys = REQUIRED_CONFIG_KEYS.filter(
  key => !firebaseConfig[key as keyof typeof firebaseConfig]
);

if (missingKeys.length > 0) {
  const errorMessage = [
    'Firebase configuration is incomplete.',
    `Missing required keys: ${missingKeys.join(', ')}`,
    '',
    'Please create a .env file in the project root with:',
    '  VITE_FIREBASE_API_KEY=your_api_key',
    '  VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com',
    '  VITE_FIREBASE_PROJECT_ID=your-project-id',
    '  VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com',
    '  VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id',
    '  VITE_FIREBASE_APP_ID=your_app_id',
    '',
    'See FIREBASE_SETUP_INSTRUCTIONS.md for detailed setup guide.',
  ].join('\n');

  // In production, throw to prevent app from running with broken config
  if (import.meta.env.PROD) {
    throw new Error(errorMessage);
  }

  // In development, log warning but allow app to continue (for UI development)
  console.error(errorMessage);
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

