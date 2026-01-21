/**
 * Planned Load Types
 * 
 * Types for the Load Planner feature - planned loads before dispatch
 */

// ============================================================================
// Planned Load Status
// ============================================================================

export type PlannedLoadStatus = 
  | 'planned'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'delivered_with_bol'
  | 'invoiced'
  | 'paid';

// ============================================================================
// Customer & Location Types
// ============================================================================

export interface Customer {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  contactName?: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  contactName?: string;
  notes?: string;
}

// ============================================================================
// Pickup & Delivery Types
// ============================================================================

export interface Pickup {
  id: string;
  shipper: Location;
  pickupDate: string;
  pickupTime?: string;
  driverInstructions?: string;
  bolNumber?: string;
  puNumber?: string;
  weight?: number;
  quantity?: number;
  quantityUnit?: 'pallets' | 'boxes' | 'cases' | 'pieces' | 'lbs' | 'kg';
  notes?: string;
  commodity?: string;
  customerRequiredInfo?: string;
}

export interface Delivery {
  id: string;
  consignee: Location;
  deliveryDate: string;
  deliveryTime?: string;
  driverInstructions?: string;
  deliveryNumber?: string;
}

// ============================================================================
// Fee Types
// ============================================================================

export type FeeType = 'flat' | 'per_mile' | 'percentage';

export interface AdditionalFee {
  id: string;
  label: string;
  amount: number;
}

export interface AccessoryFees {
  detention: number;
  lumper: number;
  stopOff: number;
  tarpFee: number;
  additional: AdditionalFee[];
}

export interface PlannedLoadFees {
  primaryFee: number;
  primaryFeeType: FeeType;
  fscAmount: number;
  fscType: FeeType;
  accessoryFees: AccessoryFees;
  invoiceAdvance: number;
}

// ============================================================================
// Planned Load Interface
// ============================================================================

export interface PlannedLoad {
  id: string;
  customLoadNumber?: string;
  systemLoadNumber: string;
  customer?: Customer;
  customerId?: string;
  
  // Stops
  pickups: Pickup[];
  deliveries: Delivery[];
  
  // Fees
  fees: PlannedLoadFees;
  
  // Legal
  legalDisclaimer?: string;
  
  // Status & Progress
  status: PlannedLoadStatus;
  currentStep: number; // 1-7 for progress tracker
  
  // Trip linking
  tripId?: string;
  tripNumber?: string;
  
  // Driver assignment
  driverId?: string;
  driverName?: string;
  
  // Documents
  rateConUrl?: string;
  bolUrl?: string;
  documents?: Array<{
    id: string;
    name: string;
    url: string;
    type: 'rate_con' | 'bol' | 'pod' | 'other';
    uploadedAt: string;
  }>;
  
  // Calculated fields
  totalMiles?: number;
  totalCharge?: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface NewPlannedLoadInput extends Omit<PlannedLoad, 'id' | 'systemLoadNumber' | 'status' | 'currentStep' | 'createdAt' | 'updatedAt'> {
  systemLoadNumber?: string;
}

// ============================================================================
// Trip Types
// ============================================================================

export type TripType = 'company' | 'broker';
export type TripStatus = 'future' | 'today' | 'past' | 'in_progress' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  tripNumber: string;
  type: TripType;
  
  // Assignment
  driverId?: string;
  driverName?: string;
  truckId?: string;
  truckNumber?: string;
  trailerId?: string;
  trailerNumber?: string;
  
  // Loads
  plannedLoadIds: string[];
  loads?: PlannedLoad[];
  
  // Dates
  pickupDate: string;
  deliveryDate: string;
  
  // Route
  fromCity: string;
  fromState: string;
  toCity: string;
  toState: string;
  
  // Status
  status: TripStatus;
  
  // Financials
  totalMiles: number;
  revenue: number;
  driverPay?: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  notes?: string;
}

export interface NewTripInput extends Omit<Trip, 'id' | 'tripNumber' | 'createdAt' | 'updatedAt'> {
  tripNumber?: string;
}
