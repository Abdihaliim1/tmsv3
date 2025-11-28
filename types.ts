
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
}

export type NewLoadInput = Omit<Load, 'id' | 'loadNumber'>;

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  type: DriverType;
  rateOrSplit: number; // e.g., 0.60 for company (cpm), 80 for OwnerOp (%)
  email: string;
  phone: string;
  truckId: string;
}

export type NewDriverInput = Omit<Driver, 'id'>;

export interface Invoice {
  id: string;
  invoiceNumber: string;
  loadId: string;
  customerName: string;
  amount: number;
  status: 'Pending' | 'Paid';
  date: string;
}

export interface Settlement {
  id: string;
  driverId: string;
  driverName: string;
  loadId: string;
  grossPay: number;
  deductions: number; // Simplified expense bucket
  netPay: number;
  status: 'Pending' | 'Processed';
  date: string;
}

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
