/**
 * Seed Data Utility
 *
 * Generates realistic mockup loads for testing and demo purposes.
 * Call generateMockupLoads() to create 20 sample loads for SARS Logistics LLC.
 */

import { NewLoadInput, LoadStatus } from '../types';

// Broker names (customers)
const BROKERS = [
  { name: 'TQL Logistics', id: 'broker-tql' },
  { name: 'C.H. Robinson', id: 'broker-chr' },
  { name: 'XPO Logistics', id: 'broker-xpo' },
  { name: 'Echo Global', id: 'broker-echo' },
  { name: 'Coyote Logistics', id: 'broker-coyote' },
  { name: 'JB Hunt Transport', id: 'broker-jbhunt' },
  { name: 'Landstar System', id: 'broker-landstar' },
  { name: 'Schneider National', id: 'broker-schneider' },
  { name: 'Werner Enterprises', id: 'broker-werner' },
  { name: 'Knight-Swift', id: 'broker-knightswift' },
];

// Common trucking routes with realistic rates
const ROUTES = [
  // Ohio hub routes
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Chicago', state: 'IL' }, miles: 355, baseRate: 850 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Atlanta', state: 'GA' }, miles: 550, baseRate: 1320 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Nashville', state: 'TN' }, miles: 380, baseRate: 912 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Detroit', state: 'MI' }, miles: 200, baseRate: 480 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Indianapolis', state: 'IN' }, miles: 175, baseRate: 420 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Pittsburgh', state: 'PA' }, miles: 185, baseRate: 444 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Cleveland', state: 'OH' }, miles: 145, baseRate: 348 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Cincinnati', state: 'OH' }, miles: 107, baseRate: 300 },

  // Chicago hub routes
  { origin: { city: 'Chicago', state: 'IL' }, dest: { city: 'Dallas', state: 'TX' }, miles: 920, baseRate: 2208 },
  { origin: { city: 'Chicago', state: 'IL' }, dest: { city: 'Minneapolis', state: 'MN' }, miles: 410, baseRate: 984 },
  { origin: { city: 'Chicago', state: 'IL' }, dest: { city: 'St. Louis', state: 'MO' }, miles: 300, baseRate: 720 },
  { origin: { city: 'Chicago', state: 'IL' }, dest: { city: 'Denver', state: 'CO' }, miles: 1010, baseRate: 2424 },

  // Texas routes
  { origin: { city: 'Dallas', state: 'TX' }, dest: { city: 'Houston', state: 'TX' }, miles: 240, baseRate: 576 },
  { origin: { city: 'Dallas', state: 'TX' }, dest: { city: 'San Antonio', state: 'TX' }, miles: 275, baseRate: 660 },
  { origin: { city: 'Houston', state: 'TX' }, dest: { city: 'New Orleans', state: 'LA' }, miles: 350, baseRate: 840 },

  // Southeast routes
  { origin: { city: 'Atlanta', state: 'GA' }, dest: { city: 'Miami', state: 'FL' }, miles: 665, baseRate: 1596 },
  { origin: { city: 'Atlanta', state: 'GA' }, dest: { city: 'Charlotte', state: 'NC' }, miles: 245, baseRate: 588 },
  { origin: { city: 'Nashville', state: 'TN' }, dest: { city: 'Memphis', state: 'TN' }, miles: 210, baseRate: 504 },

  // West Coast routes
  { origin: { city: 'Los Angeles', state: 'CA' }, dest: { city: 'Phoenix', state: 'AZ' }, miles: 370, baseRate: 888 },
  { origin: { city: 'Los Angeles', state: 'CA' }, dest: { city: 'Las Vegas', state: 'NV' }, miles: 270, baseRate: 648 },

  // Long haul routes
  { origin: { city: 'Los Angeles', state: 'CA' }, dest: { city: 'Dallas', state: 'TX' }, miles: 1435, baseRate: 3444 },
  { origin: { city: 'Chicago', state: 'IL' }, dest: { city: 'Los Angeles', state: 'CA' }, miles: 2015, baseRate: 4836 },
  { origin: { city: 'Atlanta', state: 'GA' }, dest: { city: 'Dallas', state: 'TX' }, miles: 780, baseRate: 1872 },
  { origin: { city: 'Columbus', state: 'OH' }, dest: { city: 'Dallas', state: 'TX' }, miles: 1070, baseRate: 2568 },
];

// Load statuses to distribute
const LOAD_STATUSES: LoadStatus[] = [
  LoadStatus.Available,
  LoadStatus.Dispatched,
  LoadStatus.InTransit,
  LoadStatus.Delivered,
  LoadStatus.Completed,
];

/**
 * Generate a random date within a range
 */
function randomDate(startDays: number, endDays: number): string {
  const start = new Date();
  start.setDate(start.getDate() + startDays);
  const end = new Date();
  end.setDate(end.getDate() + endDays);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString().split('T')[0];
}

/**
 * Generate a random rate variation (+/- 15%)
 */
function randomizeRate(baseRate: number): number {
  const variation = 0.85 + Math.random() * 0.30; // 85% to 115%
  return Math.round(baseRate * variation);
}

/**
 * Generate 20 realistic mockup loads
 */
export function generateMockupLoads(): NewLoadInput[] {
  const loads: NewLoadInput[] = [];

  for (let i = 0; i < 20; i++) {
    // Pick a random route
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];

    // Pick a random broker
    const broker = BROKERS[Math.floor(Math.random() * BROKERS.length)];

    // Determine status based on distribution
    // 20% available, 15% dispatched, 20% in transit, 25% delivered, 20% completed
    let status: LoadStatus;
    const statusRoll = Math.random();
    if (statusRoll < 0.20) {
      status = LoadStatus.Available;
    } else if (statusRoll < 0.35) {
      status = LoadStatus.Dispatched;
    } else if (statusRoll < 0.55) {
      status = LoadStatus.InTransit;
    } else if (statusRoll < 0.80) {
      status = LoadStatus.Delivered;
    } else {
      status = LoadStatus.Completed;
    }

    // Generate dates based on status
    let pickupDate: string;
    let deliveryDate: string;

    switch (status) {
      case LoadStatus.Available:
        // Future pickup
        pickupDate = randomDate(1, 7);
        deliveryDate = randomDate(2, 10);
        break;
      case LoadStatus.Dispatched:
        // Pickup today or tomorrow
        pickupDate = randomDate(0, 1);
        deliveryDate = randomDate(1, 5);
        break;
      case LoadStatus.InTransit:
        // Pickup was yesterday or earlier
        pickupDate = randomDate(-3, -1);
        deliveryDate = randomDate(0, 3);
        break;
      case LoadStatus.Delivered:
      case LoadStatus.Completed:
        // Both dates in the past
        pickupDate = randomDate(-14, -5);
        deliveryDate = randomDate(-7, -1);
        break;
      default:
        pickupDate = randomDate(0, 3);
        deliveryDate = randomDate(1, 5);
    }

    // Calculate rate
    const rate = randomizeRate(route.baseRate);
    const ratePerMile = parseFloat((rate / route.miles).toFixed(2));

    // Create the load
    const load: NewLoadInput = {
      status,
      customerName: broker.name,
      brokerId: broker.id,
      brokerName: broker.name,
      originCity: route.origin.city,
      originState: route.origin.state,
      destCity: route.dest.city,
      destState: route.dest.state,
      rate,
      ratePerMile,
      miles: route.miles,
      pickupDate,
      deliveryDate,
      // Add some optional fields randomly
      ...(Math.random() > 0.5 && { bolNumber: `BOL-${Date.now()}-${i}` }),
      ...(Math.random() > 0.7 && { poNumber: `PO-${100000 + Math.floor(Math.random() * 900000)}` }),
    };

    loads.push(load);
  }

  return loads;
}

/**
 * Generate a specific set of loads for demo purposes
 * These represent a typical week of operations for a small carrier
 */
export function generateDemoLoads(): NewLoadInput[] {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return [
    // Available loads - ready to be dispatched
    {
      status: LoadStatus.Available,
      customerName: 'TQL Logistics',
      brokerId: 'broker-tql',
      brokerName: 'TQL Logistics',
      originCity: 'Columbus',
      originState: 'OH',
      destCity: 'Chicago',
      destState: 'IL',
      rate: 890,
      ratePerMile: 2.51,
      miles: 355,
      pickupDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Available,
      customerName: 'C.H. Robinson',
      brokerId: 'broker-chr',
      brokerName: 'C.H. Robinson',
      originCity: 'Indianapolis',
      originState: 'IN',
      destCity: 'Detroit',
      destState: 'MI',
      rate: 680,
      ratePerMile: 2.43,
      miles: 280,
      pickupDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Available,
      customerName: 'XPO Logistics',
      brokerId: 'broker-xpo',
      brokerName: 'XPO Logistics',
      originCity: 'Nashville',
      originState: 'TN',
      destCity: 'Atlanta',
      destState: 'GA',
      rate: 625,
      ratePerMile: 2.50,
      miles: 250,
      pickupDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
    },

    // Dispatched loads - driver assigned, waiting for pickup
    {
      status: LoadStatus.Dispatched,
      customerName: 'Echo Global',
      brokerId: 'broker-echo',
      brokerName: 'Echo Global',
      originCity: 'Cleveland',
      originState: 'OH',
      destCity: 'Pittsburgh',
      destState: 'PA',
      rate: 420,
      ratePerMile: 2.33,
      miles: 180,
      pickupDate: formatDate(today),
      deliveryDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Dispatched,
      customerName: 'Coyote Logistics',
      brokerId: 'broker-coyote',
      brokerName: 'Coyote Logistics',
      originCity: 'Chicago',
      originState: 'IL',
      destCity: 'St. Louis',
      destState: 'MO',
      rate: 750,
      ratePerMile: 2.50,
      miles: 300,
      pickupDate: formatDate(today),
      deliveryDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
    },

    // In Transit loads - currently moving
    {
      status: LoadStatus.InTransit,
      customerName: 'JB Hunt Transport',
      brokerId: 'broker-jbhunt',
      brokerName: 'JB Hunt Transport',
      originCity: 'Dallas',
      originState: 'TX',
      destCity: 'Houston',
      destState: 'TX',
      rate: 600,
      ratePerMile: 2.50,
      miles: 240,
      pickupDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(today),
    },
    {
      status: LoadStatus.InTransit,
      customerName: 'Landstar System',
      brokerId: 'broker-landstar',
      brokerName: 'Landstar System',
      originCity: 'Atlanta',
      originState: 'GA',
      destCity: 'Miami',
      destState: 'FL',
      rate: 1650,
      ratePerMile: 2.48,
      miles: 665,
      pickupDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.InTransit,
      customerName: 'Schneider National',
      brokerId: 'broker-schneider',
      brokerName: 'Schneider National',
      originCity: 'Los Angeles',
      originState: 'CA',
      destCity: 'Phoenix',
      destState: 'AZ',
      rate: 920,
      ratePerMile: 2.49,
      miles: 370,
      pickupDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(today),
    },
    {
      status: LoadStatus.InTransit,
      customerName: 'Werner Enterprises',
      brokerId: 'broker-werner',
      brokerName: 'Werner Enterprises',
      originCity: 'Columbus',
      originState: 'OH',
      destCity: 'Nashville',
      destState: 'TN',
      rate: 950,
      ratePerMile: 2.50,
      miles: 380,
      pickupDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(today),
    },

    // Delivered loads - awaiting POD/invoicing
    {
      status: LoadStatus.Delivered,
      customerName: 'TQL Logistics',
      brokerId: 'broker-tql',
      brokerName: 'TQL Logistics',
      originCity: 'Memphis',
      originState: 'TN',
      destCity: 'Birmingham',
      destState: 'AL',
      rate: 525,
      ratePerMile: 2.50,
      miles: 210,
      pickupDate: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Delivered,
      customerName: 'Knight-Swift',
      brokerId: 'broker-knightswift',
      brokerName: 'Knight-Swift',
      originCity: 'Denver',
      originState: 'CO',
      destCity: 'Salt Lake City',
      destState: 'UT',
      rate: 1310,
      ratePerMile: 2.50,
      miles: 525,
      pickupDate: formatDate(new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Delivered,
      customerName: 'C.H. Robinson',
      brokerId: 'broker-chr',
      brokerName: 'C.H. Robinson',
      originCity: 'Kansas City',
      originState: 'MO',
      destCity: 'Omaha',
      destState: 'NE',
      rate: 462,
      ratePerMile: 2.50,
      miles: 185,
      pickupDate: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Delivered,
      customerName: 'XPO Logistics',
      brokerId: 'broker-xpo',
      brokerName: 'XPO Logistics',
      originCity: 'Charlotte',
      originState: 'NC',
      destCity: 'Raleigh',
      destState: 'NC',
      rate: 380,
      ratePerMile: 2.45,
      miles: 155,
      pickupDate: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
    },

    // Completed loads - fully processed
    {
      status: LoadStatus.Completed,
      customerName: 'Echo Global',
      brokerId: 'broker-echo',
      brokerName: 'Echo Global',
      originCity: 'Chicago',
      originState: 'IL',
      destCity: 'Minneapolis',
      destState: 'MN',
      rate: 1025,
      ratePerMile: 2.50,
      miles: 410,
      pickupDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Completed,
      customerName: 'Coyote Logistics',
      brokerId: 'broker-coyote',
      brokerName: 'Coyote Logistics',
      originCity: 'Houston',
      originState: 'TX',
      destCity: 'San Antonio',
      destState: 'TX',
      rate: 500,
      ratePerMile: 2.50,
      miles: 200,
      pickupDate: formatDate(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Completed,
      customerName: 'JB Hunt Transport',
      brokerId: 'broker-jbhunt',
      brokerName: 'JB Hunt Transport',
      originCity: 'Columbus',
      originState: 'OH',
      destCity: 'Cincinnati',
      destState: 'OH',
      rate: 310,
      ratePerMile: 2.90,
      miles: 107,
      pickupDate: formatDate(new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 9 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Completed,
      customerName: 'Landstar System',
      brokerId: 'broker-landstar',
      brokerName: 'Landstar System',
      originCity: 'Detroit',
      originState: 'MI',
      destCity: 'Grand Rapids',
      destState: 'MI',
      rate: 400,
      ratePerMile: 2.67,
      miles: 150,
      pickupDate: formatDate(new Date(today.getTime() - 9 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Completed,
      customerName: 'Schneider National',
      brokerId: 'broker-schneider',
      brokerName: 'Schneider National',
      originCity: 'Portland',
      originState: 'OR',
      destCity: 'Seattle',
      destState: 'WA',
      rate: 438,
      ratePerMile: 2.50,
      miles: 175,
      pickupDate: formatDate(new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000)),
    },
    {
      status: LoadStatus.Completed,
      customerName: 'Werner Enterprises',
      brokerId: 'broker-werner',
      brokerName: 'Werner Enterprises',
      originCity: 'New Orleans',
      originState: 'LA',
      destCity: 'Jackson',
      destState: 'MS',
      rate: 450,
      ratePerMile: 2.50,
      miles: 180,
      pickupDate: formatDate(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)),
      deliveryDate: formatDate(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000)),
    },
  ];
}

export default generateMockupLoads;
