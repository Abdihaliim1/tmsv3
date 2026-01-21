/**
 * Tenant & Authentication Types
 * 
 * Multi-tenant system types for organization and user management.
 */

// ============================================================================
// Tenant Types
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: string;
  updatedAt?: string;
  tenantSlug?: string;
  subdomain?: string;
}

// ============================================================================
// User Types
// ============================================================================

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

export interface UserMembership {
  tenantId: string;
  tenantName: string;
  role: UserRole;
  active: boolean;
  joinedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  defaultTenantId?: string;
  isPlatformAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Company Profile Types
// ============================================================================

export interface CompanyProfile {
  tenantId: string;
  companyName: string;
  legalName?: string;
  tagline?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  mcNumber?: string;
  dotNumber?: string;
  ein?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  invoicePrefix?: string;
  settlementPrefix?: string;
  defaultFooterText?: string;
  updatedAt: string;
  createdAt?: string;
  isSetupComplete?: boolean;
}
