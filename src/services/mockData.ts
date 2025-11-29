
import { Load, LoadStatus, Driver, Invoice, KPIMetrics, ChartDataPoint } from '../types';

export const generateMockKPIs = (): KPIMetrics => ({
  revenue: 124500,
  revenueChange: 12,
  activeLoads: 18,
  loadsChange: 5,
  activeDrivers: 4,
  driversChange: 1,
  profit: 32800,
  profitChange: 8
});

export const revenueChartData: ChartDataPoint[] = [
  { name: 'Jan', value: 65000 },
  { name: 'Feb', value: 72000 },
  { name: 'Mar', value: 85000 },
  { name: 'Apr', value: 92000 },
  { name: 'May', value: 88000 },
  { name: 'Jun', value: 124500 },
];

export const loadStatusData: ChartDataPoint[] = [
  { name: 'Available', value: 4 },
  { name: 'Dispatched', value: 6 },
  { name: 'In Transit', value: 8 },
  { name: 'Delivered', value: 12 },
];

// Mock Drivers: One Owner Operator, One Company Driver
export const initialDrivers: Driver[] = [
  {
    id: 'd1',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
    type: 'OwnerOperator',
    employeeType: 'owner_operator',
    rateOrSplit: 80, // 80% split
    email: 'john@example.com',
    phone: '555-0101',
    truckId: 'TRK-101',
    employeeNumber: 'DRV-001'
  },
  {
    id: 'd2',
    firstName: 'Mike',
    lastName: 'Smith',
    status: 'active',
    type: 'Company',
    employeeType: 'driver',
    rateOrSplit: 0.65, // $0.65 per mile
    email: 'mike@example.com',
    phone: '555-0102',
    truckId: 'TRK-102',
    employeeNumber: 'DRV-002'
  }
];

export const recentLoads: Load[] = [
  {
    id: '1',
    loadNumber: 'LD-2025-001',
    status: LoadStatus.InTransit,
    customerName: 'Midwest Distribution LLC',
    driverId: 'd1',
    driverName: 'John Doe',
    originCity: 'Columbus',
    originState: 'OH',
    destCity: 'Chicago',
    destState: 'IL',
    rate: 1200,
    miles: 350,
    pickupDate: '2025-11-25',
    deliveryDate: '2025-11-26'
  },
  {
    id: '2',
    loadNumber: 'LD-2025-002',
    status: LoadStatus.Delivered,
    customerName: 'Southern Transport',
    driverId: 'd2',
    driverName: 'Mike Smith',
    originCity: 'Atlanta',
    originState: 'GA',
    destCity: 'Nashville',
    destState: 'TN',
    rate: 850,
    miles: 250,
    pickupDate: '2025-11-24',
    deliveryDate: '2025-11-25'
  },
  {
    id: '3',
    loadNumber: 'LD-2025-003',
    status: LoadStatus.Available,
    customerName: 'Great Lakes Logistics',
    originCity: 'Detroit',
    originState: 'MI',
    destCity: 'Cleveland',
    destState: 'OH',
    rate: 900,
    miles: 170,
    pickupDate: '2025-11-27',
    deliveryDate: '2025-11-27'
  }
];

export const initialInvoices: Invoice[] = [
  {
    id: 'inv1',
    invoiceNumber: 'INV-001',
    loadId: '2',
    customerName: 'Southern Transport',
    amount: 850,
    status: 'pending',
    date: '2025-11-25',
    dueDate: '2025-12-25'
  }
];
