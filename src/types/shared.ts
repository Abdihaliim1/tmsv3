/**
 * Shared Types
 * 
 * Common types used across multiple domains.
 * Keep this file minimal - only truly shared types belong here.
 */

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentType = 'percentage' | 'per_mile' | 'flat_rate';

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType =
  | 'ratecon' | 'bol' | 'pod' | 'invoice' | 'lumper' | 'scale' | 'other'
  | 'RATE_CON' | 'BOL' | 'POD' | 'INVOICE' | 'LUMPER' | 'SCALE' | 'OTHER'
  | 'RECEIPT' | 'INSURANCE' | 'PERMIT';

export interface TmsDocument {
  id: string;
  type: DocumentType;
  name?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  url: string;
  storagePath?: string;
  entityType?: 'load' | 'invoice' | 'settlement' | 'truck';
  entityId?: string;
  uploadedAt: string;
  uploadedBy?: string;
  version?: number;
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  expiresAt?: string;
  tags?: string[];
  notes?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface KPIMetrics {
  revenue: number;
  revenueChange?: number;
  profit: number;
  profitChange?: number;
  activeLoads: number;
  loadsChange?: number;
  activeDrivers: number;
  driversChange?: number;
  completedLoads?: number;
  onTimeDelivery?: number;
  trucks?: number;
  trucksChange?: number;
}
