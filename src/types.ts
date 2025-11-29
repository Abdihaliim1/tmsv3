
export enum LoadStatus {
  Available = 'available',
  Dispatched = 'dispatched',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Completed = 'completed',
  Cancelled = 'cancelled'
}

export type DriverType = 'Company' | 'OwnerOperator';

export interface Load {
  id: string;
  loadNumber: string;
  status: LoadStatus;
  customerName: string;
  driverId?: string; // Linked to Driver
  driverName?: string; // Display purpose
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  rate: number;
  miles: number;
  pickupDate: string;
  deliveryDate: string;
  settlementId?: string; // Linked to Settlement
}

export type NewLoadInput = Omit<Load, 'id' | 'loadNumber'>;

export type DriverStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';
export type PaymentType = 'per_mile' | 'percentage' | 'flat_rate';

export interface Driver {
  id: string;
  driverNumber?: string;
  firstName: string;
  lastName: string;
  status: DriverStatus;
  type: DriverType;
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
}

export type NewDriverInput = Omit<Driver, 'id'>;

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
  createdAt?: string;
  updatedAt?: string;
}

export interface Settlement {
  id: string;
  settlementNumber?: string;
  driverId: string;
  driverName: string;
  loadId?: string;
  loadIds?: string[];
  expenseIds?: string[];
  grossPay: number;
  deductions?: number;
  totalDeductions?: number;
  fuelDeduction?: number;
  otherDeduction?: number;
  netPay: number;
  totalMiles?: number;
  status: 'pending' | 'processed' | 'paid';
  date?: string;
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
