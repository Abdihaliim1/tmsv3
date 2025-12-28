import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTenant } from './TenantContext';
import { CompanyProfile } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
// Tenant ID comes from TenantContext

// Legacy CompanySettings interface for backward compatibility
export interface CompanySettings {
  name: string;
  shortName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  dotNumber?: string;
  taxId?: string;
}

interface CompanyContextType {
  company: CompanySettings; // Legacy - for backward compatibility
  companyProfile: CompanyProfile; // New - comprehensive profile
  isLoading: boolean;
  updateCompany: (settings: Partial<CompanySettings>) => void; // Legacy
  updateCompanyProfile: (profile: Partial<CompanyProfile>) => Promise<void>; // New - saves to Firestore
  theme: {
    primary: string;
    accent: string;
  };
}

// Default company profile
const getDefaultCompanyProfile = (tenantId: string | null): CompanyProfile => {
  const now = new Date().toISOString();
  return {
    tenantId: tenantId || 'default',
    companyName: 'Transportation Management System',
    address1: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    primaryColor: '#1D4ED8', // Blue
    accentColor: '#0EA5E9', // Light blue
    invoicePrefix: 'INV',
    settlementPrefix: 'SET',
    updatedAt: now,
    createdAt: now,
    isSetupComplete: false,
  };
};

// Tenant-specific defaults
const tenantDefaultProfiles: Record<string, Partial<CompanyProfile>> = {
  'sample': {
    companyName: 'Sample Trucking',
    legalName: 'Sample Trucking LLC',
    address1: '1234 Highway 30',
    city: 'Des Moines',
    state: 'IA',
    zip: '50309',
    country: 'United States',
    phone: '(515) 555-0123',
    email: 'dispatch@sampletrucking.com',
    website: 'www.sampletrucking.com',
    dotNumber: '1234567',
    ein: '12-3456789',
    primaryColor: '#1D4ED8',
    accentColor: '#0EA5E9',
    isSetupComplete: true,
  },
  'atsfreight': {
    companyName: 'ATS Freight',
    address1: '123 Main Street',
    city: 'Columbus',
    state: 'OH',
    zip: '43215',
    country: 'United States',
    primaryColor: '#1D4ED8',
    accentColor: '#0EA5E9',
  }
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeTenantId } = useTenant();
  const tenantId = activeTenantId;

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => 
    getDefaultCompanyProfile(tenantId)
  );
  const [isLoading, setIsLoading] = useState(true);

  // Apply theme colors to CSS variables
  useEffect(() => {
    const primary = companyProfile.primaryColor || '#1D4ED8';
    const accent = companyProfile.accentColor || '#0EA5E9';
    
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--accent', accent);
    
    // Also update browser title
    if (companyProfile.companyName && companyProfile.companyName !== 'Transportation Management System') {
      document.title = `${companyProfile.companyName} - TMS Pro`;
    } else {
      document.title = 'TMS Pro';
    }
  }, [companyProfile.primaryColor, companyProfile.accentColor, companyProfile.companyName]);

  // Load company profile from Firestore (with localStorage cache)
  useEffect(() => {
    const loadCompanyProfile = async () => {
      if (!tenantId) {
        setCompanyProfile(getDefaultCompanyProfile(null));
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // First try to load from Firestore
        const docRef = doc(db, `tenants/${tenantId}/settings/companyProfile`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as CompanyProfile;
          const profile = { ...getDefaultCompanyProfile(tenantId), ...firestoreData };
          setCompanyProfile(profile);
          
          // Cache in localStorage
          const storageKey = `tms_${tenantId}_company_profile`;
          localStorage.setItem(storageKey, JSON.stringify(profile));
          
          if (import.meta.env.DEV) {
            console.log('[CompanyContext] Loaded from Firestore:', profile.companyName);
          }
        } else {
          // No Firestore data - check localStorage cache
          const storageKey = `tms_${tenantId}_company_profile`;
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            const parsed = JSON.parse(stored);
            const profile = { ...getDefaultCompanyProfile(tenantId), ...parsed };
            setCompanyProfile(profile);
            
            // Save cached data to Firestore
            await setDoc(docRef, profile, { merge: true });
            if (import.meta.env.DEV) {
              console.log('[CompanyContext] Migrated localStorage to Firestore');
            }
          } else {
            // Check for tenant-specific defaults
            if (tenantDefaultProfiles[tenantId]) {
              const tenantDefault = tenantDefaultProfiles[tenantId];
              const profile = {
                ...getDefaultCompanyProfile(tenantId),
                ...tenantDefault,
                isSetupComplete: true,
              };
              setCompanyProfile(profile);
              
              // Save to both Firestore and localStorage
              await setDoc(docRef, profile, { merge: true });
              localStorage.setItem(storageKey, JSON.stringify(profile));
              if (import.meta.env.DEV) {
                console.log('[CompanyContext] Created default profile for tenant');
              }
            } else {
              // New tenant - show setup wizard
              setCompanyProfile(getDefaultCompanyProfile(tenantId));
            }
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[CompanyContext] Error loading company profile:', error);
        
        // Fallback to localStorage if Firestore fails
        const storageKey = tenantId ? `tms_${tenantId}_company_profile` : 'tms_company_profile';
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCompanyProfile({ ...getDefaultCompanyProfile(tenantId), ...parsed });
        } else {
          setCompanyProfile(getDefaultCompanyProfile(tenantId));
        }
        
        setIsLoading(false);
      }
    };

    loadCompanyProfile();
  }, [tenantId]);

  const updateCompanyProfile = async (updates: Partial<CompanyProfile>) => {
    const updated: CompanyProfile = {
      ...companyProfile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setCompanyProfile(updated);
    
    // Save to localStorage (cache)
    const storageKey = tenantId ? `tms_${tenantId}_company_profile` : 'tms_company_profile';
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    // Save to Firestore (permanent storage)
    if (tenantId) {
      try {
        const docRef = doc(db, `tenants/${tenantId}/settings/companyProfile`);
        await setDoc(docRef, updated, { merge: true });
        if (import.meta.env.DEV) {
          console.log('[CompanyContext] Saved to Firestore:', updated.companyName);
        }
      } catch (error) {
        console.error('[CompanyContext] Error saving to Firestore:', error);
        // Data is still in localStorage, so not critical
      }
    }
  };

  // Legacy updateCompany function (for backward compatibility)
  const updateCompany = (settings: Partial<CompanySettings>) => {
    // Convert legacy CompanySettings to CompanyProfile
    const profileUpdates: Partial<CompanyProfile> = {
      companyName: settings.name,
      legalName: settings.shortName,
      address1: settings.address,
      city: settings.city,
      state: settings.state,
      zip: settings.zip,
      country: settings.country,
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      logoUrl: settings.logo,
      dotNumber: settings.dotNumber,
      ein: settings.taxId,
    };
    
    // Remove undefined values
    Object.keys(profileUpdates).forEach(key => {
      if (profileUpdates[key as keyof CompanyProfile] === undefined) {
        delete profileUpdates[key as keyof CompanyProfile];
      }
    });
    
    updateCompanyProfile(profileUpdates);
  };

  // Convert CompanyProfile to legacy CompanySettings for backward compatibility
  const legacyCompany: CompanySettings = {
    name: companyProfile.companyName,
    shortName: companyProfile.legalName,
    address: companyProfile.address1,
    city: companyProfile.city,
    state: companyProfile.state,
    zip: companyProfile.zip,
    country: companyProfile.country,
    phone: companyProfile.phone,
    email: companyProfile.email,
    website: companyProfile.website,
    logo: companyProfile.logoUrl,
    dotNumber: companyProfile.dotNumber,
    taxId: companyProfile.ein,
  };

  const theme = {
    primary: companyProfile.primaryColor || '#1D4ED8',
    accent: companyProfile.accentColor || '#0EA5E9',
  };

  return (
    <CompanyContext.Provider value={{ 
      company: legacyCompany, 
      companyProfile,
      isLoading, 
      updateCompany,
      updateCompanyProfile,
      theme,
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
