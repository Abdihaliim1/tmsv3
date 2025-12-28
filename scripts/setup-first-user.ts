/**
 * Setup Script: Create First Tenant and User Membership
 * 
 * Run this script to create:
 * 1. A default tenant
 * 2. A membership for the current user
 * 
 * Usage:
 *   npx ts-node scripts/setup-first-user.ts <user-email>
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Firebase config - update with your actual config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: 'somtms-fec81',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setupFirstUser(email: string, password: string, tenantName: string = 'Default Company') {
  try {
    console.log('🔐 Signing in...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`✅ Signed in as: ${user.email} (UID: ${user.uid})`);

    // Create tenant
    const tenantId = 'default'; // or generate a unique ID
    console.log(`\n📦 Creating tenant: ${tenantName}...`);
    
    await setDoc(doc(db, `tenants/${tenantId}`), {
      id: tenantId,
      name: tenantName,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✅ Tenant created: ${tenantId}`);

    // Create user membership
    console.log(`\n👤 Creating user membership...`);
    await setDoc(doc(db, `users/${user.uid}/memberships/${tenantId}`), {
      tenantId,
      tenantName,
      role: 'admin',
      active: true,
      joinedAt: new Date().toISOString(),
    });
    console.log(`✅ Membership created for ${user.email}`);

    console.log(`\n🎉 Setup complete!`);
    console.log(`\nYou can now login at: https://app.somtms.com`);
    console.log(`Email: ${email}`);
    console.log(`Tenant: ${tenantName}`);
    console.log(`Role: admin`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error('\n💡 User does not exist. Please create the user first in Firebase Console → Authentication');
    } else if (error.code === 'auth/wrong-password') {
      console.error('\n💡 Wrong password. Please check your password.');
    } else if (error.code === 'permission-denied') {
      console.error('\n💡 Permission denied. Make sure Firestore security rules allow writes.');
    }
    process.exit(1);
  }
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];
const tenantName = process.argv[4] || 'Default Company';

if (!email || !password) {
  console.error('Usage: npx ts-node scripts/setup-first-user.ts <email> <password> [tenant-name]');
  console.error('Example: npx ts-node scripts/setup-first-user.ts user@example.com password123 "My Company"');
  process.exit(1);
}

setupFirstUser(email, password, tenantName);


