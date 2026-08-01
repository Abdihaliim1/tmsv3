/**
 * Tenant Context - Single Domain Multi-Tenant
 *
 * AUTO-SELECTS tenant for normal users (no company picker)
 * Platform admins can switch / impersonate companies
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, UserMembership, UserProfile } from '../types';
import { useAuth } from './AuthContext';

interface TenantContextType {
  activeTenantId: string | null;
  activeTenant: Tenant | null;
  tenant: Tenant | null; // Alias for activeTenant
  memberships: UserMembership[];
  isLoading: boolean;
  error: string | null;
  isPlatformAdmin: boolean;
  selectTenant: (tenantId: string) => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'somtms_activeTenantId';
const ADMIN_VIEWING_KEY = 'somtms_adminViewingTenant';

/**
 * Load user profile from Firestore (includes defaultTenantId and isPlatformAdmin)
 */
async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const profileDoc = await getDoc(doc(db, `users/${uid}`));
    if (profileDoc.exists()) {
      const data = profileDoc.data();
      return {
        uid: profileDoc.id,
        email: data.email || null,
        displayName: data.displayName || null,
        defaultTenantId: data.defaultTenantId,
        isPlatformAdmin: data.isPlatformAdmin === true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

/**
 * Load user memberships from Firestore
 */
async function loadUserMemberships(uid: string): Promise<UserMembership[]> {
  try {
    const membershipsRef = collection(db, `users/${uid}/memberships`);
    const snapshot = await getDocs(membershipsRef);

    const memberships: UserMembership[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Use tenantId from data field if available, otherwise use document ID
      const tenantId = data.tenantId || docSnap.id;
      if (data.active !== false) {
        // Only active memberships (missing active = active)
        memberships.push({
          tenantId: tenantId,
          tenantName: data.tenantName || 'Unknown Company',
          role: data.role || 'viewer',
          active: data.active !== false,
          joinedAt: data.joinedAt,
        });
      }
    });

    return memberships;
  } catch (error) {
    console.error('Error loading user memberships:', error);
    return [];
  }
}

/**
 * Load tenant data from Firestore
 */
async function loadTenantData(tenantId: string): Promise<Tenant | null> {
  try {
    const tenantDoc = await getDoc(doc(db, `tenants/${tenantId}`));
    if (tenantDoc.exists()) {
      const data = tenantDoc.data();
      return {
        id: tenantDoc.id,
        name: data.name || 'Unknown Company',
        status: data.status || 'active',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        tenantSlug: data.tenantSlug,
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading tenant data:', error);
    return null;
  }
}

/**
 * Resolve which tenant to use (auto-selection logic)
 * Priority: admin viewing > savedTenantId > defaultTenantId > first membership
 */
function resolveTenantId(
  memberships: UserMembership[],
  savedTenantId: string | null,
  defaultTenantId: string | undefined,
  options?: { isPlatformAdmin?: boolean; adminViewingTenantId?: string | null }
): string | null {
  const adminViewing = options?.adminViewingTenantId || null;
  const platformAdmin = options?.isPlatformAdmin === true;

  // Platform admin restoring an impersonation / last company
  if (platformAdmin && adminViewing) {
    return adminViewing;
  }

  if (memberships.length === 0) {
    // Platform admins may have no membership docs — use session / default
    if (platformAdmin) {
      return savedTenantId || defaultTenantId || null;
    }
    return null;
  }

  // 1. Check saved tenant (sessionStorage)
  if (savedTenantId && memberships.find(m => m.tenantId === savedTenantId)) {
    return savedTenantId;
  }
  // Platform admin: honor saved/default even without a membership row
  if (platformAdmin && savedTenantId) {
    return savedTenantId;
  }

  // 2. Check user's defaultTenantId
  if (defaultTenantId && memberships.find(m => m.tenantId === defaultTenantId)) {
    return defaultTenantId;
  }
  if (platformAdmin && defaultTenantId) {
    return defaultTenantId;
  }

  // 3. Fall back to first membership
  return memberships[0].tenantId;
}

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  /**
   * Load memberships and AUTO-SELECT tenant (no picker for normal users)
   */
  const loadTenant = async () => {
    if (!isAuthenticated || !user) {
      setActiveTenantId(null);
      setActiveTenant(null);
      setMemberships([]);
      setIsPlatformAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load user profile (for defaultTenantId and isPlatformAdmin)
      const profile = await loadUserProfile(user.uid);
      const platformAdmin = profile?.isPlatformAdmin === true;
      setIsPlatformAdmin(platformAdmin);

      // Load user memberships
      const userMemberships = await loadUserMemberships(user.uid);
      setMemberships(userMemberships);

      // NO MEMBERSHIPS = BLOCK normal users; platform admins may still enter via Admin Console / default
      if (userMemberships.length === 0 && !platformAdmin) {
        setError('No access. Contact support.');
        setActiveTenantId(null);
        setActiveTenant(null);
        setIsLoading(false);
        return;
      }

      const savedTenantId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const adminViewingTenantId = sessionStorage.getItem(ADMIN_VIEWING_KEY);
      const selectedTenantId = resolveTenantId(
        userMemberships,
        savedTenantId,
        profile?.defaultTenantId,
        { isPlatformAdmin: platformAdmin, adminViewingTenantId }
      );

      if (selectedTenantId) {
        const tenant = await loadTenantData(selectedTenantId);
        if (tenant) {
          setActiveTenantId(selectedTenantId);
          setActiveTenant(tenant);
          sessionStorage.setItem(SESSION_STORAGE_KEY, selectedTenantId);
        } else if (userMemberships[0]) {
          // Tenant not found - try first available membership
          const fallbackTenant = await loadTenantData(userMemberships[0].tenantId);
          if (fallbackTenant) {
            setActiveTenantId(fallbackTenant.id);
            setActiveTenant(fallbackTenant);
            sessionStorage.setItem(SESSION_STORAGE_KEY, fallbackTenant.id);
          } else if (!platformAdmin) {
            setError('Company not found. Contact support.');
          }
        } else if (!platformAdmin) {
          setError('Company not found. Contact support.');
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading tenant:', err);
      setError('Failed to load. Please refresh.');
      setIsLoading(false);
    }
  };

  /**
   * Select a tenant (platform-admin impersonation / switch)
   */
  const selectTenant = async (tenantId: string) => {
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Re-read profile so we don't rely on stale state after login
      const profile = await loadUserProfile(user.uid);
      const platformAdmin = profile?.isPlatformAdmin === true;
      setIsPlatformAdmin(platformAdmin);

      if (!platformAdmin) {
        throw new Error('Only platform admins can switch companies');
      }

      // Reload memberships (optional for platform admins)
      const currentMemberships = await loadUserMemberships(user.uid);
      setMemberships(currentMemberships);

      // Platform admins may enter any tenant (impersonation) without a membership row
      const membership = currentMemberships.find(m => m.tenantId === tenantId);
      if (!membership) {
        console.info(
          `[TenantContext] Platform admin entering ${tenantId} without local membership (impersonation).`
        );
      }

      // Load tenant data
      const tenant = await loadTenantData(tenantId);
      if (!tenant) {
        throw new Error('Company not found');
      }

      // Set active tenant
      setActiveTenantId(tenantId);
      setActiveTenant(tenant);

      // Persist to sessionStorage
      sessionStorage.setItem(SESSION_STORAGE_KEY, tenantId);

      setIsLoading(false);
    } catch (err: unknown) {
      console.error('Error selecting tenant:', err);
      const message = err instanceof Error ? err.message : 'Failed to switch company';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  };

  /**
   * Refresh memberships
   */
  const refreshMemberships = async () => {
    if (!user) return;
    await loadTenant();
  };

  // Load tenant when auth state changes
  useEffect(() => {
    loadTenant();
  }, [isAuthenticated, user?.uid]);

  return (
    <TenantContext.Provider
      value={{
        activeTenantId,
        activeTenant,
        tenant: activeTenant, // Alias for activeTenant
        memberships,
        isLoading,
        error,
        isPlatformAdmin,
        selectTenant,
        refreshMemberships,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
