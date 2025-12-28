
import { Load, LoadStatus, Driver, Invoice, KPIMetrics, ChartDataPoint, Truck, Trailer, Employee } from '../types';

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

// Mock Drivers: Mix of Owner Operators and Company Drivers
export const initialDrivers: Driver[] = [
  {
    id: 'd1',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
    type: 'OwnerOperator',
    employeeType: 'driver', // Note: employeeType for drivers is 'driver', type determines Company vs OwnerOperator
    rateOrSplit: 88, // 88% split
    payPercentage: 88,
    payment: {
      type: 'percentage',
      percentage: 0.88
    },
    email: 'john.doe@atsfreight.com',
    phone: '(614) 555-0101',
    licenseNumber: 'DL123456',
    licenseState: 'OH',
    licenseExpiry: '2026-12-31',
    unitNumber: '101',
    employeeId: 'DRV-001',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'd2',
    firstName: 'Mike',
    lastName: 'Smith',
    status: 'active',
    type: 'Company',
    employeeType: 'driver',
    payPercentage: 35,
    payment: {
      type: 'percentage',
      percentage: 0.35
    },
    email: 'mike.smith@atsfreight.com',
    phone: '(614) 555-0102',
    licenseNumber: 'DL234567',
    licenseState: 'OH',
    licenseExpiry: '2025-11-30',
    unitNumber: '102',
    employeeId: 'DRV-002',
    createdAt: '2024-02-01T00:00:00Z'
  },
  {
    id: 'd3',
    firstName: 'Sarah',
    lastName: 'Williams',
    status: 'active',
    type: 'Company',
    employeeType: 'driver',
    payPercentage: 32,
    payment: {
      type: 'percentage',
      percentage: 0.32
    },
    email: 'sarah.williams@atsfreight.com',
    phone: '(614) 555-0103',
    licenseNumber: 'DL345678',
    licenseState: 'OH',
    licenseExpiry: '2026-06-15',
    unitNumber: '103',
    employeeId: 'DRV-003',
    createdAt: '2024-03-10T00:00:00Z'
  },
  {
    id: 'd4',
    firstName: 'Marcus',
    lastName: 'Johnson',
    status: 'active',
    type: 'Company',
    employeeType: 'driver',
    payPercentage: 38,
    payment: {
      type: 'percentage',
      percentage: 0.38
    },
    email: 'marcus.johnson@atsfreight.com',
    phone: '(614) 555-0104',
    licenseNumber: 'DL456789',
    licenseState: 'OH',
    licenseExpiry: '2025-09-20',
    unitNumber: '104',
    employeeId: 'DRV-004',
    createdAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'd5',
    firstName: 'Ahmed',
    lastName: 'Hassan',
    status: 'active',
    type: 'OwnerOperator',
    employeeType: 'driver', // Note: employeeType for drivers is 'driver', type determines Company vs OwnerOperator
    rateOrSplit: 85,
    payPercentage: 85,
    payment: {
      type: 'percentage',
      percentage: 0.85
    },
    email: 'ahmed.hassan@atsfreight.com',
    phone: '(614) 555-0105',
    licenseNumber: 'DL567890',
    licenseState: 'OH',
    licenseExpiry: '2026-03-31',
    unitNumber: '105',
    employeeId: 'DRV-005',
    createdAt: '2024-02-15T00:00:00Z'
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

// Mock Trucks: Mix of owned, leased, and owner-operator trucks
export const initialTrucks: Truck[] = [
  {
    id: 't1',
    truckNumber: '101',
    vin: '1FUJGHDV5DSHB1234',
    year: 2022,
    make: 'Freightliner',
    model: 'Cascadia',
    ownerType: 'owned',
    driverId: 'd1', // Assigned to John Doe
    status: 'available',
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-12-31',
    lastInspectionDate: '2025-01-15',
    nextInspectionDate: '2025-07-15',
    createdAt: '2022-01-10T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z'
  },
  {
    id: 't2',
    truckNumber: '102',
    vin: '1XP5DB0X7KD123456',
    year: 2021,
    make: 'Peterbilt',
    model: '579',
    ownerType: 'owned',
    driverId: 'd2', // Assigned to Mike Smith
    status: 'in_transit',
    insuranceExpiry: '2025-11-30',
    registrationExpiry: '2025-11-30',
    lastInspectionDate: '2025-01-10',
    nextInspectionDate: '2025-07-10',
    createdAt: '2021-06-15T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z'
  },
  {
    id: 't3',
    truckNumber: '103',
    vin: '4V4NC9EH5HN123456',
    year: 2023,
    make: 'Volvo',
    model: 'VNL 760',
    ownerType: 'owned',
    driverId: 'd3', // Assigned to Sarah Williams
    status: 'available',
    insuranceExpiry: '2025-12-15',
    registrationExpiry: '2025-12-15',
    lastInspectionDate: '2025-01-05',
    nextInspectionDate: '2025-07-05',
    createdAt: '2023-03-20T00:00:00Z',
    updatedAt: '2025-01-18T00:00:00Z'
  },
  {
    id: 't4',
    truckNumber: '104',
    vin: '1HTMMALNXJH123456',
    year: 2020,
    make: 'International',
    model: 'LT Series',
    ownerType: 'owned',
    driverId: 'd4', // Assigned to Marcus Johnson
    status: 'available',
    insuranceExpiry: '2025-10-31',
    registrationExpiry: '2025-10-31',
    lastInspectionDate: '2024-12-20',
    nextInspectionDate: '2025-06-20',
    createdAt: '2020-08-05T00:00:00Z',
    updatedAt: '2025-01-12T00:00:00Z'
  },
  {
    id: 't5',
    truckNumber: '105',
    vin: '1FUJGHDV6DSHB5678',
    year: 2022,
    make: 'Kenworth',
    model: 'T680',
    ownerType: 'owner_operator',
    driverId: 'd5', // Assigned to Ahmed Hassan (Owner Operator)
    status: 'in_transit',
    insuranceExpiry: '2025-09-30',
    registrationExpiry: '2025-09-30',
    lastInspectionDate: '2025-01-08',
    nextInspectionDate: '2025-07-08',
    notes: 'Owner Operator truck - Ahmed Hassan',
    createdAt: '2022-04-12T00:00:00Z',
    updatedAt: '2025-01-22T00:00:00Z'
  },
  {
    id: 't6',
    truckNumber: '106',
    vin: '1XP5DB0X8KD234567',
    year: 2021,
    make: 'Freightliner',
    model: 'Cascadia Evolution',
    ownerType: 'leased',
    status: 'maintenance',
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-12-31',
    lastInspectionDate: '2024-12-15',
    nextInspectionDate: '2025-06-15',
    notes: 'Leased truck - currently in maintenance',
    createdAt: '2021-09-01T00:00:00Z',
    updatedAt: '2025-01-25T00:00:00Z'
  }
];

// Mock Trailers: Mix of dry vans, reefers, and flatbeds
export const initialTrailers: Trailer[] = [
  {
    id: 'tr1',
    trailerNumber: 'T101',
    type: 'Dry Van',
    vin: '1V9VB5327M1234567',
    year: 2021,
    make: 'Great Dane',
    model: 'SD-53',
    ownerType: 'owned',
    status: 'in_use',
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-12-31',
    lastInspectionDate: '2025-01-10',
    nextInspectionDate: '2025-07-10',
    createdAt: '2021-03-15T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z'
  },
  {
    id: 'tr2',
    trailerNumber: 'T102',
    type: 'Dry Van',
    vin: '1V9VB5328M2345678',
    year: 2022,
    make: 'Utility',
    model: '3000R',
    ownerType: 'owned',
    status: 'available',
    insuranceExpiry: '2025-11-30',
    registrationExpiry: '2025-11-30',
    lastInspectionDate: '2025-01-05',
    nextInspectionDate: '2025-07-05',
    createdAt: '2022-05-20T00:00:00Z',
    updatedAt: '2025-01-18T00:00:00Z'
  },
  {
    id: 'tr3',
    trailerNumber: 'T103',
    type: 'Reefer',
    vin: '1V9VB5329M3456789',
    year: 2020,
    make: 'Carrier',
    model: 'Transicold X4',
    ownerType: 'owned',
    status: 'in_use',
    insuranceExpiry: '2025-12-15',
    registrationExpiry: '2025-12-15',
    lastInspectionDate: '2025-01-12',
    nextInspectionDate: '2025-07-12',
    notes: 'Refrigerated trailer - temperature controlled',
    createdAt: '2020-08-10T00:00:00Z',
    updatedAt: '2025-01-22T00:00:00Z'
  },
  {
    id: 'tr4',
    trailerNumber: 'T104',
    type: 'Flatbed',
    vin: '1V9VB5330M4567890',
    year: 2021,
    make: 'East Manufacturing',
    model: 'Flatbed 48ft',
    ownerType: 'owned',
    status: 'available',
    insuranceExpiry: '2025-10-31',
    registrationExpiry: '2025-10-31',
    lastInspectionDate: '2024-12-20',
    nextInspectionDate: '2025-06-20',
    notes: 'Flatbed trailer for oversized loads',
    createdAt: '2021-11-05T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z'
  },
  {
    id: 'tr5',
    trailerNumber: 'T105',
    type: 'Dry Van',
    vin: '1V9VB5331M5678901',
    year: 2023,
    make: 'Wabash National',
    model: 'Durastar',
    ownerType: 'owned',
    status: 'available',
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-12-31',
    lastInspectionDate: '2025-01-08',
    nextInspectionDate: '2025-07-08',
    createdAt: '2023-02-28T00:00:00Z',
    updatedAt: '2025-01-19T00:00:00Z'
  },
  {
    id: 'tr6',
    trailerNumber: 'T106',
    type: 'Reefer',
    vin: '1V9VB5332M6789012',
    year: 2022,
    make: 'Thermo King',
    model: 'SLXe',
    ownerType: 'leased',
    status: 'in_use',
    insuranceExpiry: '2025-09-30',
    registrationExpiry: '2025-09-30',
    lastInspectionDate: '2025-01-03',
    nextInspectionDate: '2025-07-03',
    notes: 'Leased reefer trailer',
    createdAt: '2022-07-15T00:00:00Z',
    updatedAt: '2025-01-21T00:00:00Z'
  }
];

// Mock Dispatchers
export const initialDispatchers: Employee[] = [
  {
    id: 'disp1',
    firstName: 'Abdihaliim',
    lastName: 'Ali',
    employeeType: 'dispatcher',
    status: 'active',
    email: 'asal@asal.llc',
    city: 'Columbus',
    state: 'OH',
    defaultCommissionType: 'percentage',
    defaultCommissionRate: 3, // 3% commission
    employeeId: 'DSP-001',
    employeeNumber: 'DSP-001', // For compatibility
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-01-27T00:00:00Z'
  }
];
