/**
 * Employee Types
 * 
 * All employee-related types including drivers and dispatchers.
 */

import { PaymentType } from './shared';

// ============================================================================
// Employee Enums
// ============================================================================

export type DriverType = 'Company' | 'OwnerOperator';
export type EmployeeType = 'driver' | 'dispatcher' | 'admin' | 'owner' | 'owner_operator' | 'manager' | 'safety' | 'other';
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

/** Application login / RBAC role (separate from operational employeeType). */
export type AppRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

export interface EmployeeHistoryEntry {
  at: string;
  changedBy?: string;
  /** Fields that changed */
  fields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

// ============================================================================
// Employee Interface
// ============================================================================

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  /** App RBAC role — controls who can manage employees/pay/etc. */
  appRole?: AppRole;
  
  // Legacy fields
  employeeNumber?: string;
  driverNumber?: string;
  
  // Driver-specific
  type?: DriverType;
  
  // License
  license?: {
    number?: string;
    state?: string;
    expiry?: string;
    expiration?: string;
    class?: string;
    endorsements?: string;
  };
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  
  // Medical
  medicalExpirationDate?: string;
  dob?: string;
  
  // Truck Assignment
  truckId?: string;
  currentTruckId?: string;
  
  // Payment Configuration
  payment?: {
    type: PaymentType;
    percentage?: number;
    perMileRate?: number;
    flatRate?: number;
    detention?: number;
    layover?: number;
    fuelSurcharge?: number | boolean;
  };
  
  // Legacy payment fields
  payPercentage?: number;
  rateOrSplit?: number;
  unitNumber?: string;
  
  // Address
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Tax ID
  taxIdType?: 'ssn' | 'ein';
  ssn?: string;
  ein?: string;
  
  // Dispatcher-specific
  isExternal?: boolean;
  companyName?: string;
  defaultCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  defaultCommissionRate?: number;
  dispatcherCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  dispatcherCommissionRate?: number;
  
  // Deductions
  deductionPreferences?: Record<string, number | boolean>;
  
  // Employment
  employment?: {
    startDate?: string;
    endDate?: string;
    terminationReason?: string;
    hireDate?: string;
    payFrequency?: 'weekly' | 'biweekly' | 'monthly';
    w4Exemptions?: number;
  };
  
  // Emergency Contact
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  
  // Legacy top-level pay fields
  payType?: PaymentType;
  payRate?: number;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  deactivatedAt?: string;
  /** Immutable history of rate / role / status changes */
  history?: EmployeeHistoryEntry[];
}

export type NewEmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Legacy Driver Interface
// ============================================================================

export interface Driver extends Omit<Employee, 'employeeType'> {
  employeeType: EmployeeType;
  type: DriverType;
}

export type NewDriverInput = Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Legacy Dispatcher Interface
// ============================================================================

export interface Dispatcher {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  isExternal?: boolean;
  companyName?: string;
  defaultCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  defaultCommissionRate?: number;
  status: EmployeeStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewDispatcherInput = Omit<Dispatcher, 'id'>;
