
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
  customerName: string;
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
    changedBy: string; // User/employee name or ID
    note?: string; // Optional note about the status change
  }>;
  // Notes
  notes?: Array<{
    text: string;
    author: string; // User/employee name or ID
    timestamp: string;
  }>;
  // Broker/Factoring fields
  brokerId?: string; // Linked to Customer where type="broker"
  brokerName?: string; // Display purpose
  brokerReference?: string; // Broker's load number
  factoringCompanyId?: string; // Linked to FactoringCompany
  factoringCompanyName?: string; // Display purpose
  isFactored?: boolean; // Whether load has been factored
  factoredDate?: string; // When invoice was submitted to factoring company
  factoredAmount?: number; // Amount received from factoring company
  factoringFee?: number; // Auto-calculated: Total Rate - Factored Amount
  factoringFeePercent?: number; // Factoring fee percentage (e.g., 3 for 3%)
  // Dispatcher fields
  dispatcherId?: string; // Linked to Dispatcher
  dispatcherName?: string; // Display purpose
  dispatcherCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  dispatcherCommissionRate?: number; // % or $ amount depending on type
  dispatcherCommissionAmount?: number; // Auto-calculated commission amount
  isExternalDispatch?: boolean; // If using outside dispatch company
  dispatcherPaid?: boolean; // Whether dispatcher has been paid
  dispatcherPaidDate?: string; // Date when dispatcher was paid
  // Accessorials and Detention
  hasDetention?: boolean; // Whether load has detention
  detentionLocation?: 'pickup' | 'delivery'; // Where detention occurred
  detentionHours?: number; // Hours of detention (billable hours, after free time)
  detentionRate?: number; // Rate per hour for detention
  detentionAmount?: number; // Total detention amount (detentionHours × detentionRate)
  // Layover
  hasLayover?: boolean; // Whether load has layover
  layoverDays?: number; // Number of layover days
  layoverRate?: number; // Rate per day for layover
  layoverAmount?: number; // Total layover amount (layoverDays × layoverRate)
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
  tonuFee?: number; // TONU fee amount
  totalAccessorials?: number; // Sum of all accessorials (detention + layover + lumper + fsc + tonu + other)
  grandTotal?: number; // Base rate + total accessorials (total invoice amount)
  // Driver Pay Breakdown
  driverBasePay?: number; // Driver's base pay (rate × driver percentage)
  driverDetentionPay?: number; // Driver's detention pay (usually 100% pass-through)
  driverLayoverPay?: number; // Driver's layover pay
  driverTotalGross?: number; // Total driver gross pay (base + detention + layover)
  // Broker Payment Tracking
  paymentReceived?: boolean; // Whether payment has been received from broker
  paymentReceivedDate?: string; // Date when payment was received
  paymentAmount?: number; // Amount received from broker
}

export type NewLoadInput = Omit<Load, 'id' | 'loadNumber'>;

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';
export type PaymentType = 'per_mile' | 'percentage' | 'flat_rate';
export type EmployeeType = 'driver' | 'dispatcher' | 'manager' | 'safety' | 'owner_operator' | 'owner' | 'admin' | 'other';

export interface Employee {
  id: string;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  employeeType: EmployeeType; // New: driver, dispatcher, manager, safety, owner_operator, owner, admin, other
  type: DriverType; // Legacy field for backward compatibility (maps to driver/owner_operator)
  email: string;
  phone: string;
  truckId?: string;
  currentTruckId?: string;
  // Personal Information
  dob?: string;
  ssn?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // License Information
  license?: {
    number?: string;
    state?: string;
    expiration?: string;
    class?: string;
    endorsements?: string;
  };
  medicalExpirationDate?: string;
  // Payment Configuration
  payment?: {
    type: PaymentType;
    perMileRate?: number;
    percentage?: number;
    flatRate?: number;
    detention?: number;
    layover?: number;
    fuelSurcharge?: boolean;
  };
  payPercentage?: number; // Stored separately for easier access
  // Owner Operator Deduction Preferences
  deductionPreferences?: {
    fuel?: boolean;
    insurance?: boolean;
    maintenance?: boolean;
    other?: boolean;
  };
  // Employment Information
  employment?: {
    hireDate?: string;
    payFrequency?: 'weekly' | 'bi-weekly' | 'monthly';
    w4Exemptions?: number;
  };
  // Emergency Contact
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  // Legacy fields for backward compatibility
  rateOrSplit?: number;
  driverNumber?: string; // Legacy alias for employeeNumber
  // Dispatcher-specific fields (if employeeType === 'dispatcher')
  dispatcherCommissionType?: 'percentage' | 'flat_fee' | 'per_mile';
  dispatcherCommissionRate?: number;
}

export type NewEmployeeInput = Omit<Employee, 'id'>;
export type NewDriverInput = NewEmployeeInput; // Legacy alias for backward compatibility
export type Driver = Employee; // Legacy alias for backward compatibility

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'draft';

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
  // Payment fields
  paidAmount?: number; // Amount paid by broker
  paymentMethod?: string; // Payment method (e.g., "ACH", "Check", "Wire")
  paymentReference?: string; // Payment reference number (e.g., "ACH-123456")
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
  type?: 'driver' | 'dispatcher' | 'worker';
  driverId?: string;
  dispatcherId?: string;
  workerId?: string;
  driverName: string;
  loadId?: string;
  loadIds?: string[];
  loads?: Array<{
    loadId: string;
    basePay?: number;
    detention?: number;
    tonu?: number;
    layover?: number;
    dispatchFee?: number;
  }>;
  expenseIds?: string[];
  grossPay: number;
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
    tolls?: number;
    irp?: number;
    ucr?: number;
    escrow?: number;
    occAcc?: number;
    uniform?: number;
    tonu?: number; // TONU deduction
    layover?: number; // Layover deduction
    detention?: number; // Detention deduction
    other?: number;
  };
  totalDeductions?: number;
  fuelDeduction?: number;
  otherDeduction?: number;
  otherEarnings?: Array<{
    type: string;
    description: string;
    amount: number;
  }>;
  netPay: number;
  totalMiles?: number;
  status: 'pending' | 'processed' | 'paid';
  date?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
  period?: {
    start: string;
    end: string;
    display: string;
  };
}

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
  settlementId?: string; // Linked to Settlement
  createdAt?: string;
  updatedAt?: string;
}

export type NewExpenseInput = Omit<Expense, 'id'>;

export interface KPIMetrics {
  revenue: number;
  activeLoads: number;
  activeDrivers: number;
  profit: number;
  revenueChange: number;
  loadsChange: number;
  driversChange: number;
  profitChange: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export type TruckStatus = 'available' | 'in_transit' | 'maintenance' | 'repair' | 'out_of_service';
export type TruckOwnership = 'owned' | 'leased' | 'financed' | 'owner_operator';
export type InsurancePaidBy = 'company' | 'owner_operator';

export interface Truck {
  id: string;
  number: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  status: TruckStatus;
  ownership: TruckOwnership;
  currentMileage?: number;
  assignedDriver?: string;
  lastServiceDate?: string;
  registrationExpiry?: string;
  inspectionDueDate?: string;
  cabCardRenewalDate?: string;
  // Financial fields
  monthlyPayment?: number;
  purchasePrice?: number;
  leaseEndDate?: string;
  payoffAmount?: number;
  ownerOperatorDriverId?: string;
  // Insurance fields
  insurancePaidBy?: InsurancePaidBy;
  monthlyInsuranceCost?: number;
  insuranceExpirationDate?: string;
  insuranceCertificateUrl?: string;
  notes?: string;
}

export type NewTruckInput = Omit<Truck, 'id'>;

// Trailer
export type TrailerStatus = 'available' | 'in_use' | 'maintenance' | 'repair' | 'out_of_service';
export type TrailerType = 'dry_van' | 'reefer' | 'flatbed' | 'step_deck' | 'lowboy' | 'tanker' | 'other';

export interface Trailer {
  id: string;
  number: string; // Trailer number (e.g., "TRL-001")
  licensePlate: string;
  type: TrailerType;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  status: TrailerStatus;
  currentMileage?: number;
  assignedTruckId?: string; // Currently assigned truck (can be changed)
  lastServiceDate?: string;
  registrationExpiry?: string;
  inspectionDueDate?: string;
  // Insurance (if trailer has separate insurance)
  insurancePaidBy?: InsurancePaidBy;
  monthlyInsuranceCost?: number;
  insuranceExpirationDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewTrailerInput = Omit<Trailer, 'id'>;

// Factoring Company
export interface FactoringCompany {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  feePercentage?: number; // Typical fee percentage (2-5%)
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NewFactoringCompanyInput = Omit<FactoringCompany, 'id'>;

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
