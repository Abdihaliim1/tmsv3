/**
 * Sync employee.appRole → users/{uid}.role when emails match.
 */

import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppRole } from '../types';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolve Firebase Auth uid for an email via:
 * 1) emailIndex/{email} document
 * 2) users collection query where email == (requires admin read rule)
 */
export async function resolveUidByEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  try {
    const indexRef = doc(db, 'emailIndex', normalized);
    const indexSnap = await getDoc(indexRef);
    if (indexSnap.exists() && indexSnap.data()?.uid) {
      return String(indexSnap.data().uid);
    }
  } catch {
    // index may be missing / permission denied — fall through
  }

  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', normalized),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  } catch {
    // query requires admin read on users
  }

  // Also try original casing stored on some user docs
  try {
    const q2 = query(collection(db, 'users'), where('email', '==', email.trim()), limit(1));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs[0].id;
  } catch {
    /* ignore */
  }

  return null;
}

/** Ensure emailIndex entry exists for the signed-in user (call on login). */
export async function upsertEmailIndex(uid: string, email: string | null | undefined): Promise<void> {
  if (!email) return;
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  try {
    await setDoc(
      doc(db, 'emailIndex', normalized),
      { uid, email: normalized, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to upsert emailIndex', e);
  }
}

/**
 * Push employee.appRole onto the matching Auth user document.
 * Returns linked uid if sync succeeded.
 */
export async function syncEmployeeAppRoleToUser(params: {
  email?: string | null;
  appRole?: AppRole | string | null;
  linkedUserId?: string | null;
}): Promise<string | null> {
  const role = params.appRole;
  if (!role) return null;

  let uid = params.linkedUserId || null;
  if (!uid && params.email) {
    uid = await resolveUidByEmail(params.email);
  }
  if (!uid) return null;

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        role,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    if (params.email) {
      await upsertEmailIndex(uid, params.email);
    }
    return uid;
  } catch (e) {
    console.warn('Failed to sync employee appRole to user', e);
    return null;
  }
}
