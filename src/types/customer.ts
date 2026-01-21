/**
 * Customer Types
 * 
 * Unified customer entity that can represent brokers, shippers, consignees, and general customers.
 */

// ============================================================================
// Customer Type Enum
// ============================================================================

export type CustomerType = 'broker' | 'shipper' | 'consignee' | 'customer' | 'carrier';

// ============================================================================
// Customer Interface
// ============================================================================

export interface Customer {
  id: string;
  
  // Basic Information
  name: string;
  type: CustomerType;
  aliases?: string[]; // For search (e.g., "TQL" for "Total Quality Logistics")
  
  // Search fields (auto-generated)
  searchKey: string;
  prefixes: string[];
  
  // Contact Information
  contactName?: string;
  phone?: string;
  email?: string;
  fax?: string;
  website?: string;
  
  // Address Information
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  
  // Business Information
  mcNumber?: string;  // For carriers/brokers
  dotNumber?: string; // For carriers
  ein?: string;       // Tax ID
  
  // Billing Information
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZipCode?: string;
  billingEmail?: string;
  paymentTerms?: 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Quick Pay' | 'Due on Receipt';
  creditLimit?: number;
  
  // Internal tracking
  customerNumber?: string; // Custom customer number
  notes?: string;
  tags?: string[];
  isActive?: boolean;
  
  // Statistics (computed)
  totalLoads?: number;
  totalRevenue?: number;
  lastLoadDate?: string;
  averageRate?: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ============================================================================
// Input Types
// ============================================================================

export type NewCustomerInput = Omit<Customer, 'id' | 'searchKey' | 'prefixes' | 'createdAt' | 'updatedAt'>;

export interface CustomerSearchResult {
  customer: Customer;
  matchScore: number;
  matchedOn: 'name' | 'alias' | 'prefix';
}

// ============================================================================
// Customer Filter Options
// ============================================================================

export interface CustomerFilterOptions {
  type?: CustomerType | CustomerType[];
  isActive?: boolean;
  state?: string;
  search?: string;
  tags?: string[];
}
