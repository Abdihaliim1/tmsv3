
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
