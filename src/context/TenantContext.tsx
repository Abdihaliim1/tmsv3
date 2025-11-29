import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant, getTenantFromSubdomain } from '../utils/tenant';

interface TenantContextType {
  tenantId: string | null;
  tenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get tenant ID from subdomain
        const detectedTenantId = getTenantFromSubdomain();
        
        if (!detectedTenantId) {
          setError('No tenant detected. Please access via subdomain (company1.mydomain.com)');
          setIsLoading(false);
          return;
        }

        setTenantId(detectedTenantId);

        // TODO: Load tenant data from Firestore
        // For now, use mock data
        const mockTenant: Tenant = {
          id: detectedTenantId,
          name: `${detectedTenantId.charAt(0).toUpperCase() + detectedTenantId.slice(1)} Company`,
          subdomain: detectedTenantId,
          domain: `${detectedTenantId}.mydomain.com`,
          status: 'active',
        };

        setTenant(mockTenant);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading tenant:', err);
        setError('Failed to load tenant information');
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, tenant, isLoading, error }}>
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

