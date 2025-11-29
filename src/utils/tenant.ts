/**
 * Multi-Tenant Utilities
 * Handles tenant detection and routing for subdomain-based multi-tenancy
 */

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  settings?: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get tenant ID from current subdomain
 * Example: company1.mydomain.com -> "company1"
 */
export const getTenantFromSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Handle subdomain: company1.mydomain.com
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Exclude common subdomains
    if (subdomain !== 'www' && subdomain !== 'admin' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  // Handle localhost for development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.VITE_DEFAULT_TENANT || 'demo';
  }
  
  return null;
};

/**
 * Get full domain for a tenant
 */
export const getTenantDomain = (subdomain: string, baseDomain: string = 'mydomain.com'): string => {
  return `${subdomain}.${baseDomain}`;
};

/**
 * Check if current request is for a tenant
 */
export const isTenantRequest = (): boolean => {
  return getTenantFromSubdomain() !== null;
};

/**
 * Get tenant storage path
 */
export const getTenantStoragePath = (tenantId: string, path: string = ''): string => {
  return `tenants/${tenantId}/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
};

/**
 * Validate tenant subdomain format
 */
export const isValidSubdomain = (subdomain: string): boolean => {
  // Alphanumeric and hyphens only, 3-63 characters
  const pattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return pattern.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 63;
};

/**
 * Get Firestore collection path for tenant
 */
export const getTenantCollectionPath = (tenantId: string, collection: string): string => {
  return `tenants/${tenantId}/${collection}`;
};

