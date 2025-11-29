import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTenant } from './TenantContext';

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
  company: CompanySettings;
  isLoading: boolean;
  updateCompany: (settings: Partial<CompanySettings>) => void;
}

const defaultCompany: CompanySettings = {
  name: 'Transportation Management System',
  shortName: 'TMS',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'United States',
  phone: '',
  email: '',
  website: '',
  dotNumber: '',
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  let tenantId: string | null = null;
  try {
    const tenant = useTenant();
    tenantId = tenant.tenantId;
  } catch (error) {
    // Tenant context not available, use null
    tenantId = null;
  }

  const [company, setCompany] = useState<CompanySettings>(defaultCompany);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCompanySettings = () => {
      try {
        setIsLoading(true);
        
        // Load from localStorage (tenant-aware)
        const storageKey = tenantId ? `tms_${tenantId}_company_settings` : 'tms_company_settings';
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
          const parsed = JSON.parse(stored);
          setCompany({ ...defaultCompany, ...parsed });
        } else {
          // Use default company settings
          setCompany(defaultCompany);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading company settings:', error);
        setCompany(defaultCompany);
        setIsLoading(false);
      }
    };

    loadCompanySettings();
  }, [tenantId]);

  const updateCompany = (settings: Partial<CompanySettings>) => {
    const updated = { ...company, ...settings };
    setCompany(updated);
    
    // Save to localStorage (tenant-aware)
    const storageKey = tenantId ? `tms_${tenantId}_company_settings` : 'tms_company_settings';
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  return (
    <CompanyContext.Provider value={{ company, isLoading, updateCompany }}>
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

