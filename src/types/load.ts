/**
 * Load Types
 * 
 * All types related to loads/shipments.
 */

import { TmsDocument } from './shared';

// ============================================================================
// Load Status
// ============================================================================

export enum LoadStatus {
  Available = 'available',
  Dispatched = 'dispatched',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Completed = 'completed',
  Cancelled = 'cancelled',
  TONU = 'tonu'
}

// ============================================================================
// Load Interface
// ============================================================================

export interface Load {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  customerName?: string;
  
  // Driver Assignment
  driverId?: string;
  driverName?: string;
  
  // Team Driver Support
  isTeamLoad?: boolean;
  driver2Id?: string;
  driver2Name?: string;
  driver2PayType?: 'percentage' | 'per_mile' | 'flat_rate';
  driver2PayRate?: number;
  driver2Earnings?: number;
  totalDriverPay?: number;
  
  // Route Information
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  
  // Financial
  rate: number;
  ratePerMile?: number;
  miles: number;
  
  // Dates
  pickupDate: string;
  deliveryDate: string;
  
  // Document Numbers
  bolNumber?: string;
  poNumber?: string;
  podNumber?: string;
  
  // Documents
  documents?: TmsDocument[];
  
  // Equipment
  truckId?: string;
  truckNumber?: string;
  trailerId?: string;
  trailerNumber?: string;
  
  // Invoice Linking
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;
  
  // Settlement Linking
  settlementId?: string;
  settlementNumber?: string;
  settledAt?: string;

  // Trip Linking
  tripId?: string;
  tripNumber?: string;

  // Metadata
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  
  // Status History
  statusHistory?: Array<{
    status: LoadStatus;
    timestamp: string;
    changedBy: string;           // Name of the person who made the change
    changedByRole: 'admin' | 'dispatcher' | 'driver' | 'viewer' | 'system';  // Role/account type
    changedByUserId?: string;    // User ID from auth (for audit trail)
    note?: string;
  }>;
  
  // Adjustment Log
  adjustmentLog?: Array<{
    id: string;
    timestamp: string;
    changedBy: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    reason?: string;
  }>;
  
  // Lock Status
  isLocked?: boolean;
  lockedAt?: string;
  
  // Broker Information
  brokerId?: string;
  brokerName?: string;
  brokerReference?: string;

  // Customer Information (unified customer database)
  customerId?: string;
  
  // Dispatcher Information
  dispatcherId?: string;
  dispatcherName?: string;
  dispatcherCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  dispatcherCommissionRate?: number;
  dispatcherCommissionAmount?: number;
  isExternalDispatch?: boolean;
  
  // Factoring Information
  isFactored?: boolean;
  factoringCompanyId?: string;
  factoringCompanyName?: string;
  factoringFeePercent?: number;
  factoringFee?: number;
  factoredAmount?: number;
  factoredDate?: string;
  
  // Payment Information
  paymentReceived?: boolean;
  paymentReceivedDate?: string;
  paymentAmount?: number;
  
  // Dispatcher Payment
  dispatcherPaid?: boolean;
  dispatcherPaidDate?: string;
  
  // Accessorials - Detention
  hasDetention?: boolean;
  detentionHours?: number;
  detentionRate?: number;
  detentionAmount?: number;
  detentionLocation?: string;
  driverDetentionPay?: number;
  totalAccessorials?: number;
  
  // Accessorials - Layover
  hasLayover?: boolean;
  layoverDays?: number;
  layoverRate?: number;
  layoverAmount?: number;
  driverLayoverPay?: number;
  
  // Accessorials - Lumper
  hasLumper?: boolean;
  lumperFee?: number;
  lumperAmount?: number;
  
  // Accessorials - FSC
  hasFSC?: boolean;
  fscType?: 'percentage' | 'per_mile' | 'flat';
  fscRate?: number;
  fscAmount?: number;
  
  // Other Accessorials
  otherAccessorials?: number;
  
  // TONU
  hasTONU?: boolean;
  tonuFee?: number;
  
  // Financial Totals
  grandTotal?: number;
  driverBasePay?: number;
  driverTotalGross?: number;
  
  // Additional
  notes?: string;
  changedBy?: string;
}

export interface NewLoadInput extends Omit<Load, 'id' | 'loadNumber' | 'createdAt' | 'updatedAt' | 'statusHistory'> {
  loadNumber?: string;
}

// ============================================================================
// Status Change Info - Required when changing load status
// ============================================================================

export interface StatusChangeInfo {
  changedByName: string;  // Name of the person making the change (required)
  changedByRole: 'admin' | 'dispatcher' | 'driver' | 'viewer';  // Role/account type
  note?: string;  // Optional note about the status change
}

// ============================================================================
// Adjustment Types
// ============================================================================

export interface Adjustment {
  id: string;
  tenantId?: string;
  loadId: string;
  patch: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  appliedAt?: string;
  requireApproval: boolean;
}
