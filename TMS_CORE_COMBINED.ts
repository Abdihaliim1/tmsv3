/**
 * ============================================================================
 * TMS PRO - CORE CODEBASE (COMBINED FILE)
 * ============================================================================
 * 
 * This file contains all core TypeScript code for the TMS application.
 * It combines types, business logic, services, and context providers.
 * 
 * Generated: 2025-01-27
 * Purpose: Single file for AI agent review
 * 
 * ============================================================================
 */

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================
// File: src/types.ts

export enum LoadStatus {
  Available = 'available',
  Dispatched = 'dispatched',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Completed = 'completed',
  Cancelled = 'cancelled',
  TONU = 'tonu' // Turned Down, Not Used
}

export type DriverType = 'Company' | 'OwnerOperator';

export interface Load {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  customerName?: string; // Optional: Shipper/Consignee name
  driverId?: string; // Linked to Driver
  driverName?: string; // Display purpose
  // Team Driver Support (Driver 2)
  isTeamLoad?: boolean; // Whether this is a team load with two drivers
  driver2Id?: string; // Linked to Driver 2
  driver2Name?: string; // Display purpose
  driver2PayType?: 'percentage' | 'per_mile' | 'flat_rate'; // Driver 2 pay type
  driver2PayRate?: number; // Driver 2 pay rate (percentage or per mile)
  driver2Earnings?: number; // Driver 2 earnings (auto-calculated)
  totalDriverPay?: number; // Total driver pay (Driver 1 + Driver 2)
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  rate: number; // Base rate (what broker pays for the haul)
  ratePerMile?: number; // Rate per mile (auto-calculated: rate / miles)
  miles: number;
  pickupDate: string;
  deliveryDate: string;
  // Document Numbers
  bolNumber?: string; // Bill of Lading number
  poNumber?: string; // Purchase Order number
  podNumber?: string; // Proof of Delivery number
  // Documents (future enhancement)
  documents?: Array<{
    id: string;
    type: 'bol' | 'pod' | 'rate_confirmation' | 'lumper_receipt' | 'other';
    fileName: string;
    fileUrl?: string;
    uploadedAt: string;
  }>;
  // Equipment
  truckId?: string; // Linked to Truck
  truckNumber?: string; // Truck number for display
  trailerId?: string; // Linked to Trailer (if separate entity)
  trailerNumber?: string; // Trailer number for display
  // Invoice Linking
  invoiceId?: string; // Linked to Invoice
  invoiceNumber?: string; // Invoice number for display
  invoicedAt?: string; // Date when invoice was created
  // Settlement Linking
  settlementId?: string; // Linked to Settlement
  settlementNumber?: string; // Settlement number for display
  settledAt?: string; // Date when settlement was created
  // Metadata
  createdAt?: string; // When load was created
  createdBy?: string; // User/employee ID who created the load
  updatedAt?: string; // Last update timestamp
  // Status History
  statusHistory?: Array<{
    status: LoadStatus;
    timestamp: string;
    changedBy: string;
    note?: string;
  }>;
  // Adjustment/Correction Log (for delivered loads)
  adjustmentLog?: Array<{
    id: string;
    timestamp: string;
    changedBy: string;
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }>;
  // Broker Information
  brokerId?: string;
  brokerName?: string;
  brokerReference?: string;
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
  factoringFeePercent?: number; // Fee percentage (e.g., 2.5 for 2.5%)
  factoringFee?: number; // Calculated factoring fee amount
  factoredAmount?: number; // Amount after factoring fee deducted
  factoredDate?: string;
  // Payment Information
  paymentReceived?: boolean;
  paymentReceivedDate?: string;
  paymentAmount?: number;
  // Accessorial Charges
  hasDetention?: boolean; // Whether load has detention charges
  detentionHours?: number; // Number of detention hours
  detentionRate?: number; // Rate per hour for detention
  detentionAmount?: number; // Total detention amount (detentionHours × detentionRate)
  driverDetentionPay?: number; // Driver's detention pay (100% pass-through)
  // Layover
  hasLayover?: boolean; // Whether load has layover
  layoverDays?: number; // Number of layover days
  layoverRate?: number; // Rate per day for layover
  layoverAmount?: number; // Total layover amount (layoverDays × layoverRate)
  driverLayoverPay?: number; // Driver's layover pay (100% pass-through)
  // Lumper
  hasLumper?: boolean; // Whether load has lumper fee
  lumperFee?: number; // Lumper fee amount
  lumperAmount?: number; // Alias for lumperFee (for consistency)
  // Fuel Surcharge (FSC)
  hasFSC?: boolean; // Whether load has fuel surcharge
  fscType?: 'percentage' | 'per_mile' | 'flat'; // FSC calculation type
  fscRate?: number; // FSC rate (percentage, per mile, or flat amount)
  fscAmount?: number; // Calculated FSC amount
  // Other
  otherAccessorials?: number; // Other accessorial charges
  // TONU Fee
  hasTONU?: boolean; // Whether load has TONU (Turned Down, Not Used) fee
  tonuFee?: number;
  // Financial Totals
  grandTotal?: number; // Total amount (rate + all accessorials)
  // Driver Pay (stored on load for accuracy)
  driverBasePay?: number; // Base pay (rate × driver %)
  driverDetentionPay?: number; // 100% pass-through
  driverLayoverPay?: number; // 100% pass-through
  driverTotalGross?: number; // Total driver gross pay
}

export interface NewLoadInput extends Omit<Load, 'id' | 'loadNumber' | 'createdAt' | 'updatedAt' | 'statusHistory'> {
  loadNumber?: string; // Optional - will be auto-generated if not provided
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  employeeType: 'driver' | 'dispatcher' | 'admin' | 'owner' | 'other';
  status: 'active' | 'inactive' | 'terminated';
  // Driver-specific fields (when employeeType === 'driver')
  type?: DriverType; // 'Company' or 'OwnerOperator'
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  // Payment configuration (for drivers)
  payment?: {
    type: 'percentage' | 'per_mile' | 'flat_rate';
    percentage?: number; // For percentage type (stored as decimal 0-1, e.g., 0.35 for 35%)
    perMileRate?: number; // For per_mile type
    flatRate?: number; // For flat_rate type
  };
  // Legacy fields (for backward compatibility)
  payPercentage?: number; // Legacy: driver pay percentage
  rateOrSplit?: number; // Legacy: rate or split (percentage)
  unitNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Dispatcher-specific fields (when employeeType === 'dispatcher')
  isExternal?: boolean;
  companyName?: string;
  defaultCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  defaultCommissionRate?: number;
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}

export type NewEmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

// Legacy Driver interface (for backward compatibility)
export interface Driver extends Employee {
  employeeType: 'driver';
  type: DriverType;
}

export type NewDriverInput = Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>;

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  tenantId?: string; // For multi-tenant support
  // What this task is attached to
  entityType: 'load' | 'invoice' | 'settlement' | 'driver' | 'expense' | 'truck' | 'customer';
  entityId: string;
  // Workflow identity (prevents duplicates)
  ruleId?: string;          // workflow rule that created it
  templateKey?: string;     // e.g. "LOAD_ASSIGN_DRIVER"
  dedupeKey: string;        // e.g. `${tenantId}:load:${loadId}:LOAD_ASSIGN_DRIVER`
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: string;           // ISO (renamed from dueDate for consistency)
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
  assignedTo?: string;      // Employee ID / userId
  createdBy?: string;       // userId
  completedAt?: string;
  completedBy?: string;
  // optional
  tags?: string[];
  blockers?: string[];      // list of missing requirements (e.g., "POD_REQUIRED", "BOL_REQUIRED")
  metadata?: Record<string, any>;
  // Legacy fields (for backward compatibility)
  type?: 'load_created' | 'load_dispatched' | 'load_delivered' | 'invoice_overdue' | 'pod_request' | 'rate_confirmation' | 'custom';
  dueDate?: string;         // Alias for dueAt
}

export type NewTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'dedupeKey'>;

// Workflow Event Types
export type WorkflowEventType =
  | 'LOAD_CREATED'
  | 'LOAD_STATUS_CHANGED'
  | 'LOAD_DELIVERED'
  | 'INVOICE_CREATED'
  | 'INVOICE_OVERDUE'
  | 'PAYMENT_POSTED'
  | 'DOCUMENT_UPLOADED'
  | 'SETTLEMENT_CREATED';

export interface WorkflowEvent {
  id: string;
  tenantId?: string;
  type: WorkflowEventType;
  entityType: string;
  entityId: string;
  occurredAt: string;
  payload?: Record<string, any>;
  eventKey: string; // e.g. `${type}:${entityType}:${entityId}:${occurredAt}`
}

// Workflow Rule Types
export interface WorkflowRule {
  id: string;
  tenantId?: string;
  name: string;
  isEnabled: boolean;
  eventType: WorkflowEventType;
  // optional filter conditions
  filter?: {
    loadStatusIn?: string[];
    customerIdIn?: string[];
    driverTypeIn?: ('company' | 'owner_operator')[];
    requiresFactoring?: boolean;
  };
  // tasks to create
  actions: Array<{
    type: 'CREATE_TASK';
    templateKey: string;          // stable key
    title: string;
    description?: string;
    priority: TaskPriority;
    dueOffsetMinutes?: number;    // due = eventTime + offset
    assignTo?: 'DISPATCH' | 'ACCOUNTING' | 'OWNER' | 'LOAD_DRIVER' | 'CREATOR';
    tags?: string[];
    blockers?: Array<'POD_REQUIRED' | 'BOL_REQUIRED' | 'RATECON_REQUIRED'>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'draft';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: 'ACH' | 'Check' | 'Wire' | 'Credit' | 'Factoring' | 'Other';
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  loadId?: string; // Legacy field for single load
  loadIds?: string[]; // Multiple loads per invoice
  amount: number;
  status: InvoiceStatus;
  date: string;
  dueDate?: string;
  paidAt?: string;
  // Payment fields (legacy - use payments array instead)
  paidAmount?: number; // Total paid (sum of payments) - computed field
  paymentMethod?: string; // Legacy field
  paymentReference?: string; // Legacy field
  payments?: Payment[]; // Payment history (preferred)
  // Factoring fields
  isFactored?: boolean;
  factoringCompanyId?: string;
  factoringCompanyName?: string;
  factoredDate?: string;
  factoredAmount?: number;
  factoringFee?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settlement {
  id: string;
  settlementNumber?: string;
  type: 'driver' | 'dispatcher';
  driverId?: string; // For driver settlements
  dispatcherId?: string; // For dispatcher settlements
  payeeId?: string; // Generic payee ID (legacy support)
  payeeName?: string;
  periodStart?: string;
  periodEnd?: string;
  date?: string; // Settlement date
  // Loads
  loadId?: string; // Legacy: single load
  loadIds?: string[]; // Array of load IDs
  loads?: Array<{
    loadId: string;
    basePay?: number;
    detention?: number;
    layover?: number;
    tonu?: number;
  }>;
  // Financial
  grossPay: number;
  totalDeductions?: number;
  netPay?: number;
  otherEarnings?: Array<{
    type: string;
    description?: string;
    amount: number;
  }>;
  deductions?: {
    insurance?: number;
    ifta?: number;
    cashAdvance?: number;
    fuel?: number;
    trailer?: number;
    repairs?: number;
    parking?: number;
    form2290?: number;
    eld?: number;
    toll?: number;
    irp?: number;
    ucr?: number;
    escrow?: number;
    occupationalAccident?: number;
    other?: number;
  };
  paymentMethod?: string;
  checkNumber?: string;
  notes?: string;
  // Payment status tracking
  status?: 'draft' | 'paid' | 'void'; // Settlement status
  paidAt?: string; // Date when settlement was marked as paid
  createdAt?: string;
  updatedAt?: string;
}

export interface Truck {
  id: string;
  truckNumber: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  ownerType: 'owned' | 'leased' | 'financed' | 'owner_operator';
  driverId?: string; // Current assigned driver
  status: 'available' | 'in_transit' | 'maintenance' | 'inactive';
  insuranceExpiry?: string;
  registrationExpiry?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTruckInput = Omit<Truck, 'id' | 'createdAt' | 'updatedAt'>;

export interface Trailer {
  id: string;
  trailerNumber: string;
  type?: string; // 'Dry Van', 'Reefer', 'Flatbed', etc.
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  ownerType: 'owned' | 'leased' | 'financed';
  status: 'available' | 'in_use' | 'maintenance' | 'inactive';
  insuranceExpiry?: string;
  registrationExpiry?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTrailerInput = Omit<Trailer, 'id' | 'createdAt' | 'updatedAt'>;

export interface Expense {
  id: string;
  date: string;
  type: 'fuel' | 'maintenance' | 'insurance' | 'toll' | 'lumper' | 'permit' | 'lodging' | 'other';
  category?: string; // Alias for type
  description: string;
  driverId?: string;
  driverName?: string;
  truckId?: string;
  truckNumber?: string;
  loadId?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  receipt?: string;
  vendor?: string;
  paidBy?: 'company' | 'owner_operator' | 'tracked_only';
  expenseLedger?: {
    totalAmount: number;
    amountPaid: number;
    remainingBalance: number;
    status: 'active' | 'paid' | 'cancelled';
    createdAt: string;
    lastUpdated: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type NewExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export interface FactoringCompany {
  id: string;
  name: string;
  aliases?: string[]; // Alternative names for search
  searchKey: string; // Normalized combined text for searching
  prefixes: string[]; // Prefix array for fast autocomplete
  feePercentage?: number; // Factoring fee percentage (e.g., 2.5 for 2.5%)
  paymentTerms?: string; // Payment terms (e.g., "Net 30", "Same Day")
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewFactoringCompanyInput = Omit<FactoringCompany, 'id' | 'searchKey' | 'prefixes' | 'createdAt' | 'updatedAt'>;

export interface Broker {
  id: string;
  name: string;
  aliases?: string[]; // Alternative names (e.g., ["TQL", "Total Quality Logistics"])
  searchKey: string; // Normalized combined text for searching
  prefixes: string[]; // Prefix array for fast autocomplete (e.g., ["T", "TQ", "TQL", "TOT", "TOTA", ...])
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewBrokerInput = Omit<Broker, 'id' | 'searchKey' | 'prefixes'>;

// Customer type (for broker identification)
export type CustomerType = 'customer' | 'broker' | 'shipper' | 'consignee';

// Dispatcher is now part of Employee (employeeType === 'dispatcher')
// Legacy Dispatcher interface kept for backward compatibility
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
  status: 'active' | 'inactive';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewDispatcherInput = Omit<Dispatcher, 'id'>;

export interface IFTAStateMiles {
  id: string;
  loadId: string;
  state: string; // State code (e.g., "OH", "IL")
  miles: number;
  date: string; // Trip date
  truckId?: string;
  driverId?: string;
  createdAt?: string;
}

export interface IFTAFuelPurchase {
  id: string;
  date: string;
  state: string; // State where fuel was purchased
  gallons: number;
  cost: number;
  truckId?: string;
  driverId?: string;
  vendor?: string;
  receiptNumber?: string;
  odometerReading?: number;
  createdAt?: string;
}

export interface IFTAReport {
  id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  stateMiles: Record<string, number>; // State code -> total miles
  fuelPurchases: Record<string, { gallons: number; cost: number }>; // State code -> fuel data
  mpg: number; // Overall MPG
  taxDue: Record<string, number>; // State code -> tax due/credit
  status: 'draft' | 'filed' | 'paid';
  filedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIMetrics {
  revenue: number;
  profit: number;
  activeLoads: number;
  activeDrivers: number;
  completedLoads: number;
  onTimeDelivery: number; // Percentage
}

// ============================================================================
// SECTION 2: BUSINESS LOGIC SERVICE
// ============================================================================
// File: src/services/businessLogic.ts

/**
 * Business Logic Service - Single Source of Truth for All Calculations
 * 
 * This module centralizes ALL business calculations to ensure consistency:
 * - Driver pay calculations (NO hardcoded fallbacks)
 * - Settlement math
 * - Invoice totals
 * - Reporting revenue/profit
 * 
 * CRITICAL: All pages MUST import from this module, not duplicate logic.
 */

// Note: This would normally import from types, but in combined file we have types above
// import { Load, Driver, Settlement, Invoice, Expense } from '../types';

// Helper function (would normally be in utils.ts)
function calculateCompanyRevenue(grossAmount: number, driver?: Driver): number {
  if (!driver || !grossAmount) return grossAmount || 0;
  // Company Driver: Company keeps 100% of revenue (Driver paid separately via payroll/settlement)
  if (driver.type === 'Company') {
      return grossAmount;
  }
  // Owner Operator: Company keeps commission only (e.g. 12% if driver gets 88%)
  if (driver.type === 'OwnerOperator') {
      const driverSplit = driver.rateOrSplit / 100; // e.g. 0.88
      const companyCommission = 1 - driverSplit;    // e.g. 0.12
      return grossAmount * companyCommission;
  }
  return grossAmount;
}

/**
 * Calculate driver pay for a load based on driver's payment profile
 * 
 * PRIORITY ORDER:
 * 1. Use stored driverTotalGross from load (most accurate - calculated at delivery)
 * 2. Use stored driverBasePay + accessorials from load
 * 3. Calculate from driver's payment profile
 * 
 * NO HARDCODED FALLBACKS - If driver profile is missing, returns 0
 */
export function calculateDriverPay(load: Load, driver?: Driver): number {
  if (!driver) return 0;

  // PRIORITY 1: Use stored driver pay from load (most accurate)
  if (load.driverTotalGross !== undefined && load.driverTotalGross > 0) {
    return load.driverTotalGross;
  }

  // PRIORITY 2: Use stored base pay + accessorials
  if (load.driverBasePay !== undefined && load.driverBasePay > 0) {
    return load.driverBasePay + (load.driverDetentionPay || 0) + (load.driverLayoverPay || 0);
  }

  // PRIORITY 3: Calculate from driver's payment profile
  const loadRate = load.rate || load.grandTotal || 0;
  const loadMiles = load.miles || 0;

  // Owner Operator: use rateOrSplit or payPercentage
  if (driver.type === 'OwnerOperator') {
    const payPercentage = driver.payment?.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : (driver.rateOrSplit ? (driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit) : 0));
    
    if (payPercentage === 0) {
      console.warn(`[BUSINESS LOGIC] Owner Operator ${driver.firstName} ${driver.lastName} has no pay percentage configured. Pay = 0.`);
      return 0;
    }
    
    return loadRate * payPercentage;
  }

  // Company Driver: calculate based on payment type
  if (driver.payment?.type === 'percentage') {
    const payPercentage = driver.payment.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : 0);
    
    if (payPercentage === 0) {
      console.warn(`[BUSINESS LOGIC] Company Driver ${driver.firstName} ${driver.lastName} has no pay percentage configured. Pay = 0.`);
      return 0;
    }
    
    return loadRate * payPercentage;
  } else if (driver.payment?.type === 'per_mile') {
    const ratePerMile = driver.payment.perMileRate || 0;
    if (ratePerMile === 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no per-mile rate configured. Pay = 0.`);
      return 0;
    }
    return loadMiles * ratePerMile;
  } else if (driver.payment?.type === 'flat_rate') {
    const flatRate = driver.payment.flatRate || 0;
    if (flatRate === 0) {
      console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} has no flat rate configured. Pay = 0.`);
      return 0;
    }
    return flatRate;
  }

  // Fallback: use rateOrSplit or payPercentage if available (backward compatibility)
  if (driver.rateOrSplit || driver.payPercentage) {
    const payPercentage = driver.rateOrSplit
      ? (driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit)
      : (driver.payPercentage! > 1 ? driver.payPercentage! / 100 : driver.payPercentage!);
    return loadRate * payPercentage;
  }

  // NO HARDCODED FALLBACK - Return 0 if profile is missing
  console.warn(`[BUSINESS LOGIC] Driver ${driver.firstName} ${driver.lastName} (ID: ${driver.id}) has no payment configuration. Pay = 0.`);
  return 0;
}

/**
 * Calculate driver base pay (before accessorials)
 */
export function calculateDriverBasePay(load: Load, driver?: Driver): number {
  if (!driver) return 0;

  // Use stored base pay if available
  if (load.driverBasePay !== undefined && load.driverBasePay > 0) {
    return load.driverBasePay;
  }

  // Calculate from driver's payment profile
  const loadRate = load.rate || load.grandTotal || 0;
  const loadMiles = load.miles || 0;

  if (driver.payment?.type === 'percentage') {
    const payPercentage = driver.payment.percentage !== undefined
      ? (driver.payment.percentage > 1 ? driver.payment.percentage / 100 : driver.payment.percentage)
      : (driver.payPercentage !== undefined
          ? (driver.payPercentage > 1 ? driver.payPercentage / 100 : driver.payPercentage)
          : 0);
    return loadRate * payPercentage;
  } else if (driver.payment?.type === 'per_mile') {
    return (loadMiles || 0) * (driver.payment.perMileRate || 0);
  } else if (driver.payment?.type === 'flat_rate') {
    return driver.payment.flatRate || 0;
  }

  // Fallback to rateOrSplit
  if (driver.rateOrSplit) {
    const payPercentage = driver.rateOrSplit > 1 ? driver.rateOrSplit / 100 : driver.rateOrSplit;
    return loadRate * payPercentage;
  }

  return 0;
}

/**
 * Calculate settlement gross pay from loads
 */
export function calculateSettlementGrossPay(
  loads: Load[],
  driver: Driver,
  settlementLoads: Array<{ loadId: string; basePay?: number; detention?: number; layover?: number; tonu?: number }>
): number {
  let grossPay = 0;

  settlementLoads.forEach(settlementLoad => {
    const load = loads.find(l => l.id === settlementLoad.loadId);
    if (!load) return;

    // Use settlement load values if available, otherwise calculate
    if (settlementLoad.basePay !== undefined) {
      grossPay += settlementLoad.basePay;
    } else {
      grossPay += calculateDriverBasePay(load, driver);
    }

    // Add accessorials (100% pass-through)
    grossPay += settlementLoad.detention || load.driverDetentionPay || 0;
    grossPay += settlementLoad.layover || load.driverLayoverPay || 0;
    grossPay += settlementLoad.tonu || (load as any).tonuFee || 0;
  });

  return grossPay;
}

/**
 * Calculate settlement total deductions
 */
export function calculateSettlementDeductions(settlement: Settlement): number {
  const deductions = settlement.deductions || {};
  
  return (
    (deductions.insurance || 0) +
    (deductions.ifta || 0) +
    (deductions.cashAdvance || 0) +
    (deductions.fuel || 0) +
    (deductions.trailer || 0) +
    (deductions.repairs || 0) +
    (deductions.parking || 0) +
    (deductions.form2290 || 0) +
    (deductions.eld || 0) +
    (deductions.toll || 0) +
    (deductions.irp || 0) +
    (deductions.ucr || 0) +
    (deductions.escrow || 0) +
    (deductions.occupationalAccident || 0) +
    (deductions.other || 0)
  );
}

/**
 * Calculate settlement net pay
 */
export function calculateSettlementNetPay(settlement: Settlement): number {
  const grossPay = settlement.grossPay || 0;
  const totalDeductions = calculateSettlementDeductions(settlement);
  const otherEarnings = (settlement.otherEarnings || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  
  return grossPay + otherEarnings - totalDeductions;
}

/**
 * Calculate invoice total from loads
 */
export function calculateInvoiceTotal(loads: Load[]): number {
  return loads.reduce((sum, load) => {
    return sum + (load.grandTotal || load.rate || 0);
  }, 0);
}

/**
 * Calculate invoice grand total (including taxes, fees, etc.)
 */
export function calculateInvoiceGrandTotal(invoice: Invoice): number {
  return invoice.amount || 0;
  // Future: Add tax, fees, discounts here if needed
}

/**
 * Calculate period revenue (filtered by delivery date)
 */
export function calculatePeriodRevenue(
  loads: Load[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  const periodLoads = loads.filter(load => {
    const isDelivered = load.status === 'delivered' || load.status === 'completed';
    if (!isDelivered) return false;
    
    const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
    if (isNaN(deliveryDate.getTime())) return false;
    return deliveryDate >= periodStart && deliveryDate <= periodEnd;
  });

  let totalRevenue = 0;
  periodLoads.forEach(load => {
    const grossAmount = load.grandTotal || load.rate || 0;
    if (load.driverId) {
      const driver = drivers.find(d => d.id === load.driverId);
      totalRevenue += calculateCompanyRevenue(grossAmount, driver);
    } else {
      totalRevenue += grossAmount;
    }
  });

  return totalRevenue;
}

/**
 * Calculate period driver pay (from settlements or loads)
 */
export function calculatePeriodDriverPay(
  loads: Load[],
  settlements: Settlement[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  // Filter settlements by load delivery dates (not settlement creation date)
  const periodSettlements = settlements.filter(settlement => {
    if (settlement.type !== 'driver' && settlement.type) return false;
    
    const settlementLoadIds: string[] = [];
    if (settlement.loadId) settlementLoadIds.push(settlement.loadId);
    if (settlement.loadIds) settlementLoadIds.push(...settlement.loadIds);
    if (settlement.loads) {
      settlement.loads.forEach(l => {
        if (l.loadId && !settlementLoadIds.includes(l.loadId)) {
          settlementLoadIds.push(l.loadId);
        }
      });
    }

    if (settlementLoadIds.length === 0) return false;

    // Only include if ALL loads were delivered in period
    return settlementLoadIds.every(loadId => {
      const load = loads.find(l => l.id === loadId);
      if (!load) return false;
      const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
      if (isNaN(deliveryDate.getTime())) return false;
      return deliveryDate >= periodStart && deliveryDate <= periodEnd;
    });
  });

  let totalDriverPay = 0;
  periodSettlements.forEach(settlement => {
    const payeeId = (settlement as any).payeeId || settlement.driverId;
    const driver = drivers.find(d => d.id === payeeId);
    if (driver) {
      if (driver.type === 'OwnerOperator') {
        totalDriverPay += settlement.grossPay || 0;
      } else {
        totalDriverPay += settlement.netPay || 0;
      }
    }
  });

  // If no settlements, estimate from loads
  if (periodSettlements.length === 0) {
    const periodLoads = loads.filter(load => {
      const isDelivered = load.status === 'delivered' || load.status === 'completed';
      if (!isDelivered || !load.driverId) return false;
      const deliveryDate = new Date(load.deliveryDate || load.pickupDate || '');
      if (isNaN(deliveryDate.getTime())) return false;
      return deliveryDate >= periodStart && deliveryDate <= periodEnd;
    });

    periodLoads.forEach(load => {
      const driver = drivers.find(d => d.id === load.driverId);
      if (driver) {
        totalDriverPay += calculateDriverPay(load, driver);
      }
    });
  }

  return totalDriverPay;
}

/**
 * Calculate period profit (revenue - driver pay - expenses)
 */
export function calculatePeriodProfit(
  loads: Load[],
  expenses: Expense[],
  settlements: Settlement[],
  periodStart: Date,
  periodEnd: Date,
  drivers: Driver[]
): number {
  const revenue = calculatePeriodRevenue(loads, periodStart, periodEnd, drivers);
  const driverPay = calculatePeriodDriverPay(loads, settlements, periodStart, periodEnd, drivers);
  
  // Filter expenses by date
  const periodExpenses = expenses.filter(exp => {
    const expenseDate = new Date(exp.date);
    if (isNaN(expenseDate.getTime())) return false;
    return expenseDate >= periodStart && expenseDate <= periodEnd;
  });

  // Only include company-paid expenses (exclude O/O pass-through)
  const companyExpenses = periodExpenses.filter(exp => {
    if (exp.paidBy !== 'company' && exp.paidBy !== 'tracked_only' && exp.paidBy) {
      return false;
    }
    
    // Exclude O/O pass-through expenses
    if (exp.driverId) {
      const driver = drivers.find(d => d.id === exp.driverId);
      if (driver && driver.type === 'OwnerOperator') {
        const expenseType = (exp.type || '').toLowerCase();
        const isPassThrough = 
          expenseType === 'fuel' || 
          expenseType === 'insurance' || 
          expenseType === 'toll' ||
          expenseType === 'maintenance';
        if (isPassThrough) return false;
      }
    }
    
    return true;
  });

  const totalExpenses = companyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return revenue - driverPay - totalExpenses;
}

// ============================================================================
// SECTION 3: INVOICE SERVICE
// ============================================================================
// File: src/services/invoiceService.ts

/**
 * Invoice Service - Production-Grade Invoice Number Generation
 * 
 * Generates globally unique, sequential invoice numbers that are:
 * - Safe against deletions (uses max sequence, not array length)
 * - Tenant-aware (multi-tenant safe)
 * - Concurrency-safe (uses atomic counter)
 * - Year-based (INV-YYYY-NNNN format)
 */

const COUNTER_STORAGE_KEY = 'invoice_counter';

/**
 * Get tenant-aware storage key for invoice counter
 */
function getCounterKey(tenantId: string | null): string {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}${COUNTER_STORAGE_KEY}`;
}

/**
 * Get the current year
 */
function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Initialize or get the invoice counter for a tenant
 * Counter structure: { year: number, seq: number }
 */
function getCounter(tenantId: string | null): { year: number; seq: number } {
  const key = getCounterKey(tenantId);
  const stored = localStorage.getItem(key);
  
  if (stored) {
    try {
      const counter = JSON.parse(stored);
      // If year changed, reset sequence
      if (counter.year !== getCurrentYear()) {
        return { year: getCurrentYear(), seq: 1000 };
      }
      return counter;
    } catch {
      // Invalid stored data, reset
      return { year: getCurrentYear(), seq: 1000 };
    }
  }
  
  // First time - start at 1000
  return { year: getCurrentYear(), seq: 1000 };
}

/**
 * Save the counter atomically
 */
function saveCounter(tenantId: string | null, counter: { year: number; seq: number }): void {
  const key = getCounterKey(tenantId);
  localStorage.setItem(key, JSON.stringify(counter));
}

/**
 * Generate a globally unique invoice number
 * 
 * Format: INV-YYYY-NNNN
 * Example: INV-2025-1001, INV-2025-1002, etc.
 * 
 * This function is atomic and safe for concurrent access.
 * It uses a counter that persists across deletions and is tenant-aware.
 */
export function generateUniqueInvoiceNumber(
  tenantId: string | null,
  existingInvoices: Invoice[] = []
): string {
  const year = getCurrentYear();
  const counter = getCounter(tenantId);
  
  // If year changed, reset sequence
  if (counter.year !== year) {
    counter.year = year;
    counter.seq = 1000;
  }
  
  // Increment sequence atomically
  counter.seq += 1;
  saveCounter(tenantId, counter);
  
  // Generate invoice number
  const invoiceNumber = `INV-${year}-${counter.seq}`;
  
  // Safety check: Verify uniqueness against existing invoices (defensive programming)
  // This should never happen if counter is working correctly, but we check anyway
  const isDuplicate = existingInvoices.some(inv => inv.invoiceNumber === invoiceNumber);
  if (isDuplicate) {
    console.error(`[INVOICE SERVICE] Duplicate invoice number detected: ${invoiceNumber}. This should not happen.`);
    // Increment again and try once more
    counter.seq += 1;
    saveCounter(tenantId, counter);
    return `INV-${year}-${counter.seq}`;
  }
  
  return invoiceNumber;
}

/**
 * Get the next invoice number without incrementing (for preview)
 */
export function previewNextInvoiceNumber(tenantId: string | null): string {
  const year = getCurrentYear();
  const counter = getCounter(tenantId);
  
  if (counter.year !== year) {
    return `INV-${year}-1001`;
  }
  
  return `INV-${year}-${counter.seq + 1}`;
}

/**
 * Reset invoice counter (admin function - use with caution)
 * Only resets if no invoices exist for the current year
 */
export function resetInvoiceCounter(tenantId: string | null, existingInvoices: Invoice[]): boolean {
  const year = getCurrentYear();
  const yearInvoices = existingInvoices.filter(inv => {
    const invYear = new Date(inv.date).getFullYear();
    return invYear === year;
  });
  
  if (yearInvoices.length > 0) {
    console.warn('[INVOICE SERVICE] Cannot reset counter: invoices exist for current year');
    return false;
  }
  
  const counter = { year, seq: 1000 };
  saveCounter(tenantId, counter);
  return true;
}

/**
 * Sync counter with existing invoices (recovery function)
 * Use this if counter gets out of sync
 */
export function syncInvoiceCounter(tenantId: string | null, existingInvoices: Invoice[]): void {
  const year = getCurrentYear();
  
  // Extract all invoice numbers for current year
  const yearInvoices = existingInvoices.filter(inv => {
    const invYear = new Date(inv.date).getFullYear();
    return invYear === year;
  });
  
  // Find max sequence number
  const pattern = new RegExp(`^INV-${year}-(\\d+)$`);
  let maxSeq = 1000;
  
  yearInvoices.forEach(inv => {
    const match = inv.invoiceNumber.match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  
  // Update counter to max + 1 (so next invoice is max + 1)
  const counter = { year, seq: maxSeq };
  saveCounter(tenantId, counter);
  
  console.log(`[INVOICE SERVICE] Counter synced to ${maxSeq} for year ${year}`);
}

// ============================================================================
// SECTION 4: RBAC SERVICE
// ============================================================================
// File: src/services/rbac.ts

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Defines roles, permissions, and access control checks
 */

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * Permission definitions
 */
const PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    permissions: [
      { resource: 'loads', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'drivers', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'invoices', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'settlements', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'expenses', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'fleet', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'settings', actions: ['read', 'update'] },
      { resource: 'tasks', actions: ['read', 'update', 'delete'] },
    ],
  },
  dispatcher: {
    role: 'dispatcher',
    permissions: [
      { resource: 'loads', actions: ['create', 'read', 'update'] },
      { resource: 'drivers', actions: ['read'] },
      { resource: 'invoices', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'expenses', actions: ['read'] },
      { resource: 'fleet', actions: ['read'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  driver: {
    role: 'driver',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  accountant: {
    role: 'accountant',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'invoices', actions: ['create', 'read', 'update'] },
      { resource: 'settlements', actions: ['create', 'read', 'update'] },
      { resource: 'expenses', actions: ['create', 'read', 'update'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'tasks', actions: ['read', 'update'] },
    ],
  },
  viewer: {
    role: 'viewer',
    permissions: [
      { resource: 'loads', actions: ['read'] },
      { resource: 'drivers', actions: ['read'] },
      { resource: 'invoices', actions: ['read'] },
      { resource: 'settlements', actions: ['read'] },
      { resource: 'expenses', actions: ['read'] },
      { resource: 'fleet', actions: ['read'] },
      { resource: 'reports', actions: ['read'] },
    ],
  },
};

/**
 * Check if user has permission for an action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;

  const resourcePerm = rolePerms.permissions.find(p => p.resource === resource);
  if (!resourcePerm) return false;

  return resourcePerm.actions.includes(action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return PERMISSIONS[role]?.permissions || [];
}

/**
 * Check if user can access a page/route
 */
export function canAccessPage(role: UserRole, page: string): boolean {
  // Admin can access everything
  if (role === 'admin') return true;

  // Map pages to resources
  const pageResourceMap: Record<string, string> = {
    'Dashboard': 'loads',
    'Loads': 'loads',
    'Drivers': 'drivers',
    'Fleet': 'fleet',
    'Expenses': 'expenses',
    'Settlements': 'settlements',
    'Reports': 'reports',
    'AccountReceivables': 'invoices',
    'Tasks': 'tasks',
    'Settings': 'settings',
    'Import': 'loads',
  };

  const resource = pageResourceMap[page] || page.toLowerCase();
  return hasPermission(role, resource, 'read');
}

/**
 * Check if user can perform action (used in UI components)
 */
export function canPerformAction(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  return hasPermission(role, resource, action);
}

// ============================================================================
// SECTION 5: WORKFLOW ENGINE
// ============================================================================
// File: src/services/workflow/workflowEngine.ts

/**
 * Workflow Engine - Event-Driven Task Creation
 * 
 * Handles:
 * - Processing workflow events
 * - Matching rules to events
 * - Creating tasks idempotently
 */

// Note: These would normally import from other files, but in combined file we have them above
// import { WorkflowEvent, WorkflowRule, Task, TaskPriority } from '../../types';
// import { loadWorkflowRules } from './workflowRules';
// import { createTaskIfNotExists, generateDedupeKey } from './taskService';

// Helper function to get tenant (would normally be in utils/tenant.ts)
function getTenantFromSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0]; // e.g., "atsfreight" from "atsfreight.asal.llc"
  }
  return null;
}

// Helper functions from workflowRules.ts (simplified for combined file)
function loadWorkflowRules(tenantId: string | null): WorkflowRule[] {
  // In real implementation, this loads from localStorage or Firestore
  // For combined file, return empty array (rules would be defined elsewhere)
  return [];
}

// Helper functions from taskService.ts (simplified for combined file)
function generateDedupeKey(
  tenantId: string | null,
  entityType: string,
  entityId: string,
  templateKey: string
): string {
  const tenant = tenantId || 'default';
  return `${tenant}:${entityType}:${entityId}:${templateKey}`;
}

function createTaskIfNotExists(
  tenantId: string | null,
  taskInput: NewTaskInput & { dedupeKey: string }
): Task | null {
  // In real implementation, this creates task in localStorage
  // For combined file, return null (implementation would be in full file)
  return null;
}

/**
 * Match a rule filter against an event payload
 */
function matchesRuleFilter(rule: WorkflowRule, event: WorkflowEvent): boolean {
  if (!rule.filter) return true; // No filter = matches all

  const payload = event.payload || {};

  // Check loadStatusIn filter (for LOAD_STATUS_CHANGED events)
  if (rule.filter.loadStatusIn && payload.newStatus) {
    if (!rule.filter.loadStatusIn.includes(payload.newStatus)) {
      return false;
    }
  }

  // Check customerIdIn filter
  if (rule.filter.customerIdIn && payload.customerId) {
    if (!rule.filter.customerIdIn.includes(payload.customerId)) {
      return false;
    }
  }

  // Check driverTypeIn filter
  if (rule.filter.driverTypeIn && payload.driverType) {
    const normalized = payload.driverType.toLowerCase().replace('_', '');
    if (!rule.filter.driverTypeIn.some(dt => normalized.includes(dt))) {
      return false;
    }
  }

  // Check requiresFactoring filter
  if (rule.filter.requiresFactoring !== undefined && payload.isFactored !== undefined) {
    if (rule.filter.requiresFactoring !== payload.isFactored) {
      return false;
    }
  }

  return true;
}

/**
 * Determine who to assign the task to
 */
function resolveAssignee(
  assignTo: string | undefined,
  event: WorkflowEvent,
  payload: Record<string, any>
): string | undefined {
  if (!assignTo) return undefined;

  switch (assignTo) {
    case 'LOAD_DRIVER':
      return payload.driverId;
    case 'CREATOR':
      return payload.createdBy;
    case 'DISPATCH':
    case 'ACCOUNTING':
    case 'OWNER':
      // These would need to be resolved to actual user IDs
      // For now, return undefined (unassigned)
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Trigger workflow - process an event and create tasks
 */
export async function triggerWorkflow(
  tenantId: string | null,
  event: WorkflowEvent
): Promise<Task[]> {
  const rules = loadWorkflowRules(tenantId);
  const createdTasks: Task[] = [];

  // Find matching rules
  const matchingRules = rules.filter(rule => {
    if (!rule.isEnabled) return false;
    if (rule.eventType !== event.type) return false;
    return matchesRuleFilter(rule, event);
  });

  // Process each matching rule
  for (const rule of matchingRules) {
    for (const action of rule.actions) {
      if (action.type !== 'CREATE_TASK') continue;

      // Generate dedupeKey
      const dedupeKey = generateDedupeKey(
        tenantId,
        event.entityType,
        event.entityId,
        action.templateKey
      );

      // Calculate due date
      const dueAt = action.dueOffsetMinutes
        ? new Date(Date.now() + action.dueOffsetMinutes * 60_000).toISOString()
        : undefined;

      // Resolve assignee
      const assignedTo = resolveAssignee(action.assignTo, event, event.payload || {});

      // Determine initial status (blocked if blockers exist)
      const status: TaskStatus = action.blockers && action.blockers.length > 0
        ? 'blocked'
        : 'pending';

      // Create task
      const task = createTaskIfNotExists(tenantId, {
        entityType: event.entityType as Task['entityType'],
        entityId: event.entityId,
        ruleId: rule.id,
        templateKey: action.templateKey,
        dedupeKey,
        title: action.title,
        description: action.description,
        priority: action.priority,
        status,
        dueAt,
        assignedTo,
        tags: action.tags || [],
        blockers: action.blockers || [],
        metadata: {
          eventId: event.id,
          eventType: event.type,
        },
      });

      if (task) {
        createdTasks.push(task);
      }
    }
  }

  return createdTasks;
}

/**
 * Create a workflow event object
 */
export function createWorkflowEvent(
  type: WorkflowEvent['type'],
  entityType: string,
  entityId: string,
  payload?: Record<string, any>
): WorkflowEvent {
  const tenantId = getTenantFromSubdomain();
  const occurredAt = new Date().toISOString();
  const eventKey = `${type}:${entityType}:${entityId}:${occurredAt}`;

  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tenantId: tenantId || undefined,
    type,
    entityType,
    entityId,
    occurredAt,
    payload,
    eventKey,
  };
}

/**
 * Helper: Trigger workflow for load created
 */
export function triggerLoadCreated(loadId: string, loadData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent('LOAD_CREATED', 'load', loadId, {
    ...loadData,
    createdBy: loadData.createdBy,
  });
  const tenantId = getTenantFromSubdomain();
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for load status changed
 */
export function triggerLoadStatusChanged(
  loadId: string,
  oldStatus: string,
  newStatus: string,
  loadData: Record<string, any>
): Promise<Task[]> {
  const event = createWorkflowEvent('LOAD_STATUS_CHANGED', 'load', loadId, {
    oldStatus,
    newStatus,
    ...loadData,
  });
  const tenantId = getTenantFromSubdomain();
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for load delivered
 */
export function triggerLoadDelivered(loadId: string, loadData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent('LOAD_DELIVERED', 'load', loadId, {
    ...loadData,
  });
  const tenantId = getTenantFromSubdomain();
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for invoice created
 */
export function triggerInvoiceCreated(invoiceId: string, invoiceData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent('INVOICE_CREATED', 'invoice', invoiceId, {
    ...invoiceData,
  });
  const tenantId = getTenantFromSubdomain();
  return triggerWorkflow(tenantId, event);
}

/**
 * Helper: Trigger workflow for invoice overdue
 */
export function triggerInvoiceOverdue(invoiceId: string, invoiceData: Record<string, any>): Promise<Task[]> {
  const event = createWorkflowEvent('INVOICE_OVERDUE', 'invoice', invoiceId, {
    ...invoiceData,
  });
  const tenantId = getTenantFromSubdomain();
  return triggerWorkflow(tenantId, event);
}

// ============================================================================
// SECTION 6: TASK SERVICE
// ============================================================================
// File: src/services/workflow/taskService.ts

/**
 * Task Service - Task Management with Idempotency
 * 
 * Handles:
 * - Task creation with deduplication (idempotent)
 * - Task storage in localStorage (tenant-aware)
 * - Task ID generation from dedupeKey
 */

/**
 * Generate a stable task ID from dedupeKey using hash
 */
export function taskIdFromDedupeKey(dedupeKey: string): string {
  // Simple stable hash
  let h = 0;
  for (let i = 0; i < dedupeKey.length; i++) {
    h = ((h << 5) - h) + dedupeKey.charCodeAt(i);
    h = h & h; // Convert to 32bit integer
  }
  // Ensure positive and add prefix
  const hash = Math.abs(h).toString(16);
  return `task_${hash}`;
}

/**
 * Generate dedupeKey for a task
 */
export function generateDedupeKey(
  tenantId: string | null,
  entityType: string,
  entityId: string,
  templateKey: string
): string {
  const tenant = tenantId || 'default';
  return `${tenant}:${entityType}:${entityId}:${templateKey}`;
}

/**
 * Get storage key for tasks (tenant-aware)
 */
function getStorageKey(tenantId: string | null): string {
  const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
  return `${prefix}tasks`;
}

/**
 * Load tasks from localStorage
 */
export function loadTasks(tenantId: string | null): Task[] {
  try {
    const storageKey = getStorageKey(tenantId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.warn('Error loading tasks from localStorage:', error);
  }
  return [];
}

/**
 * Save tasks to localStorage
 */
export function saveTasks(tenantId: string | null, tasks: Task[]): void {
  try {
    const storageKey = getStorageKey(tenantId);
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving tasks to localStorage:', error);
  }
}

/**
 * Create task if it doesn't already exist (idempotent)
 */
export function createTaskIfNotExists(
  tenantId: string | null,
  taskInput: NewTaskInput & { dedupeKey: string }
): Task | null {
  const tasks = loadTasks(tenantId);

  // Check if task with this dedupeKey already exists
  const existing = tasks.find(t => t.dedupeKey === taskInput.dedupeKey);
  if (existing) {
    return existing; // Already exists, return it
  }

  // Generate ID from dedupeKey
  const id = taskIdFromDedupeKey(taskInput.dedupeKey);

  // Create new task
  const now = new Date().toISOString();
  const task: Task = {
    ...taskInput,
    id,
    tenantId: tenantId || undefined,
    createdAt: now,
    updatedAt: now,
    dueAt: taskInput.dueAt || taskInput.dueDate, // Support both fields
    dueDate: taskInput.dueDate || taskInput.dueAt, // Keep for backward compatibility
  };

  // Add to array and save
  tasks.push(task);
  saveTasks(tenantId, tasks);

  return task;
}

/**
 * Update an existing task
 */
export function updateTask(
  tenantId: string | null,
  taskId: string,
  updates: Partial<Task>
): Task | null {
  const tasks = loadTasks(tenantId);
  const index = tasks.findIndex(t => t.id === taskId);

  if (index === -1) {
    console.warn(`Task ${taskId} not found`);
    return null;
  }

  // Update task
  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    // Sync dueAt and dueDate
    dueAt: updates.dueAt || tasks[index].dueAt || updates.dueDate,
    dueDate: updates.dueDate || tasks[index].dueDate || updates.dueAt,
  };

  saveTasks(tenantId, tasks);
  return tasks[index];
}

/**
 * Complete a task
 */
export function completeTask(
  tenantId: string | null,
  taskId: string,
  completedBy?: string
): Task | null {
  const now = new Date().toISOString();
  return updateTask(tenantId, taskId, {
    status: 'completed',
    completedAt: now,
    completedBy,
  });
}

/**
 * Assign a task
 */
export function assignTask(
  tenantId: string | null,
  taskId: string,
  assignedTo: string
): Task | null {
  return updateTask(tenantId, taskId, {
    assignedTo,
    status: 'in_progress', // Auto-set to in_progress when assigned
  });
}

/**
 * Get tasks by filter
 */
export function getTasks(
  tenantId: string | null,
  filters?: {
    status?: TaskStatus;
    entityType?: string;
    entityId?: string;
    assignedTo?: string;
    priority?: TaskPriority;
  }
): Task[] {
  const tasks = loadTasks(tenantId);

  if (!filters) return tasks;

  return tasks.filter(task => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.entityType && task.entityType !== filters.entityType) return false;
    if (filters.entityId && task.entityId !== filters.entityId) return false;
    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    return true;
  });
}

/**
 * Delete a task
 */
export function deleteTask(tenantId: string | null, taskId: string): boolean {
  const tasks = loadTasks(tenantId);
  const filtered = tasks.filter(t => t.id !== taskId);
  
  if (filtered.length === tasks.length) {
    return false; // Task not found
  }

  saveTasks(tenantId, filtered);
  return true;
}

// ============================================================================
// SECTION 7: WORKFLOW RULES
// ============================================================================
// File: src/services/workflow/workflowRules.ts

/**
 * Workflow Rules - Default Rules for TMS
 * 
 * These are the starter pack of workflow rules that create tasks
 * automatically when events occur.
 */

/**
 * Default workflow rules (can be stored in localStorage or Firestore later)
 */
export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  // Load Created
  {
    id: 'rule_load_created',
    name: 'Load Created - Initial Tasks',
    isEnabled: true,
    eventType: 'LOAD_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_ASSIGN_DRIVER',
        title: 'Assign driver to load',
        description: 'A new load has been created and needs a driver assignment.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 60, // Due in 1 hour
        assignTo: 'DISPATCH',
        tags: ['load', 'dispatch'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_SEND_RATE_CONFIRMATION',
        title: 'Send rate confirmation',
        description: 'Rate confirmation document needs to be sent to customer.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 120, // Due in 2 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'document'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_CONFIRM_PICKUP_APPT',
        title: 'Confirm pickup appointment',
        description: 'Confirm pickup appointment time with shipper.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 240, // Due in 4 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'pickup'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Load Status Changed to Dispatched
  {
    id: 'rule_load_dispatched',
    name: 'Load Dispatched - Follow-up Tasks',
    isEnabled: true,
    eventType: 'LOAD_STATUS_CHANGED',
    filter: {
      loadStatusIn: ['dispatched'],
    },
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_CONFIRM_PICKUP',
        title: 'Confirm pickup (same day)',
        description: 'Follow up to confirm pickup has occurred.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 30, // Due in 30 minutes
        assignTo: 'DISPATCH',
        tags: ['load', 'pickup'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_TRACK_IN_TRANSIT',
        title: 'Track in-transit update',
        description: 'Monitor load progress while in transit.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 1440, // Due in 24 hours
        assignTo: 'DISPATCH',
        tags: ['load', 'tracking'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Load Delivered
  {
    id: 'rule_load_delivered',
    name: 'Load Delivered - Post-Delivery Tasks',
    isEnabled: true,
    eventType: 'LOAD_DELIVERED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_COLLECT_POD',
        title: 'Collect POD',
        description: 'Proof of Delivery document is required for invoicing.',
        priority: 'high' as TaskPriority,
        dueOffsetMinutes: 60, // Due in 1 hour
        assignTo: 'DISPATCH',
        tags: ['load', 'pod', 'document'],
        blockers: ['POD_REQUIRED'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'LOAD_GENERATE_INVOICE',
        title: 'Generate invoice',
        description: 'Invoice should be generated for this delivered load.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 120, // Due in 2 hours
        assignTo: 'ACCOUNTING',
        tags: ['load', 'invoice', 'ar'],
        blockers: ['POD_REQUIRED'], // Blocked until POD is uploaded
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Invoice Created
  {
    id: 'rule_invoice_created',
    name: 'Invoice Created - AR Tasks',
    isEnabled: true,
    eventType: 'INVOICE_CREATED',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_SEND_TO_CUSTOMER',
        title: 'Send invoice to customer',
        description: 'Invoice has been created and should be sent to customer.',
        priority: 'medium' as TaskPriority,
        dueOffsetMinutes: 30, // Due in 30 minutes
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar'],
      },
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_START_AR_FOLLOWUP',
        title: 'Start AR follow-up cycle',
        description: 'Begin accounts receivable follow-up process.',
        priority: 'low' as TaskPriority,
        dueOffsetMinutes: 43200, // Due in 30 days (when invoice becomes due)
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar', 'followup'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Invoice Overdue
  {
    id: 'rule_invoice_overdue',
    name: 'Invoice Overdue - Escalation',
    isEnabled: true,
    eventType: 'INVOICE_OVERDUE',
    actions: [
      {
        type: 'CREATE_TASK',
        templateKey: 'INVOICE_FOLLOWUP_OVERDUE',
        title: 'Follow up overdue invoice',
        description: 'Invoice is past due date and requires immediate attention.',
        priority: 'urgent' as TaskPriority,
        assignTo: 'ACCOUNTING',
        tags: ['invoice', 'ar', 'overdue', 'urgent'],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Load workflow rules from localStorage (or Firestore later)
 */
export function loadWorkflowRules(tenantId: string | null): WorkflowRule[] {
  try {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    const storageKey = `${prefix}workflow_rules`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : DEFAULT_WORKFLOW_RULES;
    }
  } catch (error) {
    console.warn('Error loading workflow rules:', error);
  }
  
  // Return defaults if nothing stored
  return DEFAULT_WORKFLOW_RULES;
}

/**
 * Save workflow rules to localStorage
 */
export function saveWorkflowRules(tenantId: string | null, rules: WorkflowRule[]): void {
  try {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    const storageKey = `${prefix}workflow_rules`;
    localStorage.setItem(storageKey, JSON.stringify(rules));
  } catch (error) {
    console.error('Error saving workflow rules:', error);
  }
}

/**
 * Initialize workflow rules (first time setup)
 */
export function initializeWorkflowRules(tenantId: string | null): void {
  const existing = loadWorkflowRules(tenantId);
  if (existing.length === 0) {
    saveWorkflowRules(tenantId, DEFAULT_WORKFLOW_RULES);
  }
}

// ============================================================================
// SECTION 8: GUARDRAILS
// ============================================================================
// File: src/services/workflow/guardrails.ts

/**
 * Guardrails - Operational Rules Enforcement
 * 
 * Handles:
 * - Validation checks before allowing operations
 * - Blocked task creation when requirements aren't met
 */

// Note: canInvoiceLoad and canDispatchLoad would normally be in documentService.ts
// For combined file, simplified versions:

function canInvoiceLoad(load: Load): { canInvoice: boolean; missingDocs: string[] } {
  const missingDocs: string[] = [];
  
  if (!load.podNumber && !load.documents?.some(d => d.type === 'pod')) {
    missingDocs.push('pod');
  }
  
  return {
    canInvoice: missingDocs.length === 0,
    missingDocs
  };
}

function canDispatchLoad(load: Load): { canDispatch: boolean; missingDocs: string[] } {
  const missingDocs: string[] = [];
  
  if (!load.bolNumber && !load.documents?.some(d => d.type === 'bol')) {
    missingDocs.push('bol');
  }
  
  return {
    canDispatch: missingDocs.length === 0,
    missingDocs
  };
}

/**
 * Check if load can be invoiced and create blocked task if not
 */
export function checkCanInvoice(
  load: Load,
  documents?: Array<{ type: string; entityId: string }>
): { ok: boolean; blockers: string[]; taskCreated?: boolean } {
  const blockers: string[] = [];

  // Check delivery date
  if (!load.deliveryDate && !load.pickupDate) {
    blockers.push('Missing delivery date');
  }

  // Check customer/broker
  if (!load.brokerName && !load.customerName) {
    blockers.push('Missing broker/customer');
  }

  // Check rate
  if (!load.rate || load.rate <= 0) {
    blockers.push('Invalid rate (must be greater than 0)');
  }

  // Check POD (use document service)
  const docCheck = canInvoiceLoad(load);
  if (!docCheck.canInvoice) {
    blockers.push(...docCheck.missingDocs.map(doc => `Missing ${doc.toUpperCase()}`));
  }

  // If blocked, create a blocked task
  if (blockers.length > 0) {
    const tenantId = getTenantFromSubdomain();
    const dedupeKey = generateDedupeKey(tenantId, 'load', load.id, 'INVOICE_BLOCKED');

    createTaskIfNotExists(tenantId, {
      entityType: 'load',
      entityId: load.id,
      templateKey: 'INVOICE_BLOCKED',
      dedupeKey,
      title: `Invoice blocked for Load ${load.loadNumber}`,
      description: `Cannot create invoice due to: ${blockers.join(', ')}`,
      priority: 'high',
      status: 'blocked',
      blockers,
      tags: ['invoice', 'blocked', 'load'],
    });

    return { ok: false, blockers, taskCreated: true };
  }

  return { ok: true, blockers: [] };
}

/**
 * Check if load can be dispatched and create blocked task if not
 */
export function checkCanDispatch(
  load: Load,
  documents?: Array<{ type: string; entityId: string }>
): { ok: boolean; blockers: string[]; taskCreated?: boolean } {
  const blockers: string[] = [];

  // Check driver assignment
  if (!load.driverId) {
    blockers.push('Missing driver assignment');
  }

  // Check BOL and rate confirmation (use document service)
  const docCheck = canDispatchLoad(load);
  if (!docCheck.canDispatch) {
    blockers.push(...docCheck.missingDocs.map(doc => `Missing ${doc.toUpperCase()}`));
  }

  // Check pickup date
  if (!load.pickupDate) {
    blockers.push('Missing pickup date');
  }

  // If blocked, create a blocked task
  if (blockers.length > 0) {
    const tenantId = getTenantFromSubdomain();
    const dedupeKey = generateDedupeKey(tenantId, 'load', load.id, 'DISPATCH_BLOCKED');

    createTaskIfNotExists(tenantId, {
      entityType: 'load',
      entityId: load.id,
      templateKey: 'DISPATCH_BLOCKED',
      dedupeKey,
      title: `Dispatch blocked for Load ${load.loadNumber}`,
      description: `Cannot dispatch load due to: ${blockers.join(', ')}`,
      priority: 'high',
      status: 'blocked',
      blockers,
      tags: ['dispatch', 'blocked', 'load'],
    });

    return { ok: false, blockers, taskCreated: true };
  }

  return { ok: true, blockers: [] };
}

/**
 * Validate invoice requirements
 */
export function validateInvoiceRequirements(invoice: Invoice): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (!invoice.customerName) {
    blockers.push('Missing customer name');
  }

  if (!invoice.amount || invoice.amount <= 0) {
    blockers.push('Invalid invoice amount');
  }

  if (!invoice.date) {
    blockers.push('Missing invoice date');
  }

  return { ok: blockers.length === 0, blockers };
}

// ============================================================================
// SECTION 9: AUTH CONTEXT
// ============================================================================
// File: src/context/AuthContext.tsx

// Note: This is a React component, but for combined file we show the core logic
// In real implementation, this would use React hooks

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

interface User {
  username: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Hardcoded credentials
const VALID_CREDENTIALS = {
  username: 'Abdihaliim',
  password: 'Abdi1234',
  name: 'Abdihaliim',
  role: 'admin' as UserRole
};

const STORAGE_KEY = 'tms_auth_user';

// Core login function (simplified for combined file - real implementation uses React hooks)
export function loginUser(username: string, password: string): boolean {
  const normalizedUsername = username.trim();
  const normalizedValidUsername = VALID_CREDENTIALS.username.trim();

  if (
    normalizedUsername.toLowerCase() === normalizedValidUsername.toLowerCase() &&
    password === VALID_CREDENTIALS.password
  ) {
    const userData: User = {
      username: normalizedUsername,
      name: VALID_CREDENTIALS.name,
      role: VALID_CREDENTIALS.role
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    return true;
  }
  
  return false;
}

// Core logout function
export function logoutUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// SECTION 10: TMS CONTEXT (CORE LOGIC ONLY)
// ============================================================================
// File: src/context/TMSContext.tsx

// Note: This is a React Context Provider, but for combined file we show key functions
// The full implementation would be 800+ lines with React hooks

// Key functions from TMSContext:

/**
 * Update load with adjustment log tracking
 */
export function updateLoadWithAdjustmentLog(
  oldLoad: Load,
  updates: Partial<Load>
): Load {
  // Check if load is delivered/completed - if so, track adjustments
  const isDelivered = oldLoad.status === 'delivered' || oldLoad.status === 'completed';
  const adjustmentEntries: Array<{
    id: string;
    timestamp: string;
    changedBy: string;
    field: string;
    oldValue: any;
    newValue: any;
    reason?: string;
  }> = [];

  if (isDelivered) {
    // Track all changes to delivered loads
    const currentUser = localStorage.getItem('tms_auth_user');
    const changedBy = currentUser ? JSON.parse(currentUser).username || 'system' : 'system';
    const timestamp = new Date().toISOString();

    // Compare each field in updates
    Object.keys(updates).forEach((key) => {
      const oldValue = (oldLoad as any)[key];
      const newValue = (updates as any)[key];
      
      // Only log if value actually changed
      if (oldValue !== newValue && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        adjustmentEntries.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp,
          changedBy,
          field: key,
          oldValue,
          newValue,
          reason: `Adjustment to delivered load`
        });
      }
    });
  }

  // Merge adjustment log entries
  const existingAdjustmentLog = oldLoad.adjustmentLog || [];
  const newAdjustmentLog = [...existingAdjustmentLog, ...adjustmentEntries];

  return { 
    ...oldLoad, 
    ...updates,
    adjustmentLog: adjustmentEntries.length > 0 ? newAdjustmentLog : oldLoad.adjustmentLog,
    updatedAt: new Date().toISOString()
  };
}

// ============================================================================
// END OF COMBINED FILE
// ============================================================================
/**
 * 
 * NOTE: This is a combined file for AI agent review.
 * 
 * The actual codebase is split across multiple files:
 * - src/types.ts (all type definitions)
 * - src/services/businessLogic.ts (calculation logic)
 * - src/services/invoiceService.ts (invoice numbering)
 * - src/services/rbac.ts (access control)
 * - src/services/workflow/* (workflow engine)
 * - src/context/AuthContext.tsx (authentication)
 * - src/context/TMSContext.tsx (main state management)
 * 
 * The settlement PDF generation (src/services/settlementPDF.ts) is a large file
 * (800+ lines) and is not included here due to size, but it generates PDFs
 * using jsPDF library.
 * 
 * For a complete review, the expert should also see:
 * - UI components (React pages)
 * - Configuration files
 * - Documentation (docs/CORE_VALUES_AND_LOGIC.md)
 * 
 */


