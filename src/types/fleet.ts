/**
 * Fleet Types
 * 
 * Trucks, trailers, and equipment management types.
 */

// ============================================================================
// Fleet Enums
// ============================================================================

export type TruckStatus = 'available' | 'in_transit' | 'maintenance' | 'inactive' | 'repair';
export type TruckOwnership = 'owned' | 'leased' | 'financed' | 'owner_operator';
export type InsurancePaidBy = 'company' | 'driver' | 'split' | 'owner_operator';
export type TrailerStatus = 'available' | 'in_use' | 'maintenance' | 'inactive' | 'repair';
export type TrailerType = 'dry_van' | 'reefer' | 'flatbed' | 'step_deck' | 'lowboy' | 'tanker' | 'other';

// ============================================================================
// Truck Interface
// ============================================================================

export interface Truck {
  id: string;
  truckNumber: string;
  number?: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  ownerType: TruckOwnership;
  ownership?: TruckOwnership;
  driverId?: string;
  assignedDriver?: string;
  ownerOperatorDriverId?: string;
  status: TruckStatus;
  licensePlate?: string;
  currentMileage?: number;
  lastServiceDate?: string;
  insuranceExpiry?: string;
  insurancePaidBy?: InsurancePaidBy;
  monthlyInsuranceCost?: number;
  registrationExpiry?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  inspectionDueDate?: string;
  cabCardRenewalDate?: string;
  leaseEndDate?: string;
  insuranceExpirationDate?: string;
  monthlyPayment?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  payoffAmount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTruckInput = Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Trailer Interface
// ============================================================================

export interface Trailer {
  id: string;
  trailerNumber?: string;
  number?: string;
  type?: TrailerType | string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  ownerType?: 'owned' | 'leased' | 'financed';
  status: TrailerStatus;
  licensePlate?: string;
  assignedTruckId?: string;
  currentMileage?: number;
  lastServiceDate?: string;
  insuranceExpiry?: string;
  insuranceExpirationDate?: string;
  insurancePaidBy?: InsurancePaidBy;
  monthlyInsuranceCost?: number;
  registrationExpiry?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  inspectionDueDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTrailerInput = Omit<Trailer, 'id' | 'createdAt' | 'updatedAt'>;
