/**
 * Customer Seed Service
 *
 * Seeds the customer database with common brokers.
 * Converts broker data to the unified Customer format.
 */

import { Customer as CustomerEntity, CustomerType } from '../types/customer';
import { normalize, generatePrefixes, generateSearchKey } from './brokerUtils';

// ============================================================================
// Common Brokers List
// ============================================================================

const COMMON_BROKERS: string[] = [
  'A. Duie Pyle Logistics',
  'AAA Cooper Transportation Logistics',
  'ABF Logistics (ArcBest)',
  'AIT Worldwide Logistics',
  'Allen Lund Company',
  'Amazon Freight',
  'American Logistics Company',
  'Anderson Trucking Service (ATS Logistics)',
  'APL Logistics',
  'ArcBest / MoLo Solutions',
  'Arrive Logistics',
  'Ascent Global Logistics',
  'Averitt Integrated Logistics',
  'Banyan Technology (broker tools, common)',
  'BDG International',
  'Bellair Expediting',
  'BlueGrace Logistics',
  'BNSF Logistics',
  'Bostrom Logistics',
  'Bravo Logistics',
  'Brenntag Logistics (3PL services)',
  'Bridgepoint Logistics',
  'Buchanan Logistics',
  'Burns Logistics',
  'Buske Logistics',
  'Burris Logistics',
  'BVC Logistics',
  'C.H. Robinson',
  'Capital Logistics Group',
  'Cardinal Logistics Management',
  'Cargomatic',
  'Cargo Transporters Logistics',
  'Cedar Logistics',
  'Celadon Logistics (legacy)',
  'Central Freight Lines Logistics (legacy)',
  'Charger Logistics Brokerage',
  'CHRW Managed Solutions',
  'Circle Logistics',
  'Clear Lane Freight Systems',
  'Cloud Logistics (3PL)',
  'Continental Logistics',
  'Convoy (legacy brand)',
  'Core Logistics',
  'Cornerstone Systems',
  'Cowan Systems Brokerage',
  'Crane Worldwide Logistics',
  'Crowley Logistics',
  'Daseke Logistics Services',
  'DB Schenker Logistics',
  'Dedicated Logistics Services',
  'DHL Global Forwarding',
  'DHL Supply Chain Freight Management',
  'Diligent Delivery Systems',
  'DSV Road / DSV Solutions',
  'DT Logistics',
  'Dupré Logistics (logistics arm)',
  'Echo Global Logistics',
  'EFW (Estes Forwarding Worldwide)',
  'England Logistics',
  'Epic Freight Solutions',
  'Estes Logistics',
  'Expedite All',
  'Expedite Network Logistics',
  'FAK Logistics',
  'FCI Logistics',
  'FedEx Supply Chain Logistics',
  'Fidelity Logistics',
  'First Star Logistics',
  'Flexport',
  'Foodliner Logistics',
  'Forward Air (Forward Logistics)',
  'Freightquote (C.H. Robinson group)',
  'FreightCenter',
  'FreightWorks',
  'FTL Hub Logistics',
  'GEODIS',
  'GlobalTranz',
  'GP Transco Logistics',
  'Graebel Logistics Services',
  'Greatwide Logistics Services',
  'Greenbush Logistics',
  'Gulf Relay Logistics (brokerage arm)',
  'H. Robinson TMS (managed)',
  'Hart Logistics',
  'Hayes Freight Lines Brokerage',
  'HD Supply Freight Management',
  'Hub Group Logistics',
  'HNI Logistics',
  'Horizon Freight System',
  'Hot Shot Logistics',
  'IMC Logistics',
  'IMS Logistics',
  'Indiana Transportation Logistics',
  'Integrity Express Logistics',
  'Intermodal Logistics Group',
  'International Logistics Group (ILG)',
  'Iron Mountain Logistics (services)',
  'JAS Worldwide',
  'J.B. Hunt 360 / Brokerage',
  'JCT Logistics',
  'Jetco Delivery',
  'JLE Industries Logistics',
  'John Christner Trucking Logistics',
  'Jones Logistics',
  'JUSDA Logistics',
  'KAG Logistics (Kenan Advantage)',
  'Kenco Logistics',
  'Keystone Freight Corp Logistics',
  'Knight Logistics',
  'Kuehne+Nagel',
  'K&L Freight Services',
  'Landstar Brokerage / Logistics',
  'Legend Transportation',
  'Len Dubois Trucking Logistics',
  'Lineage Logistics (freight services)',
  'Lipsey Logistics',
  'Loadsmart',
  'Lone Star Transportation Logistics',
  'Louis Dreyfus Logistics (services)',
  'Magellan Transport Logistics',
  'Mainfreight',
  'Mallory Alexander International Logistics',
  'Matson Logistics',
  'Maverick Logistics',
  'MCT Transportation Logistics',
  'MegaCorp Logistics',
  'Meridian Logistics',
  'Meta Logistics',
  'Mode Transportation',
  'MoLo Solutions (ArcBest)',
  'MTS Logistics',
  'Murphy Logistics',
  'Mustang Logistics Group',
  'NFI Industries (logistics/brokerage)',
  'NHT Logistics',
  'NI Logistics',
  'Nolan Transportation Group (NTG)',
  'NorthPoint Logistics',
  'Nuvocargo',
  'Odyssey Logistics & Technology',
  'ODW Logistics',
  'OIA Global',
  'Old Dominion Logistics',
  'Omnitrans Logistics',
  'On Time Logistics',
  'Optym Freight Management',
  'OTR Solutions (broker tools + factoring)',
  'Pacer Logistics (legacy)',
  'Pasha Freight',
  'Penske Logistics',
  'Performance Team (Maersk)',
  'Pilot Freight Services',
  'PLG Logistics',
  'PLS Logistics Services',
  'Polaris Transportation Logistics',
  'Powerhouse Logistics',
  'Priority1',
  'ProTrans International',
  'PS Logistics',
  'Purolator Logistics (services)',
  'Quality Carriers Logistics (services)',
  'Radiant Logistics',
  'R+L Global Logistics',
  'R2 Logistics',
  'Ravn Logistics',
  'Redline Logistics',
  'Redwood Logistics',
  'ReedTMS Logistics',
  'Reliable Transportation Specialists',
  'RoadOne IntermodaLogistics',
  'Röhlig Logistics',
  'Ruan Logistics',
  'Ryder Supply Chain Solutions',
  'RXO (brokerage)',
  'Saddle Creek Logistics',
  'Saia Logistics',
  'Schneider Logistics / Brokerage',
  'SEKO Logistics',
  'Service Transport Company Logistics',
  'ShipEX',
  'Shipwell',
  'Spartan Logistics',
  'Spot Freight',
  'Sterling Transportation',
  'STG Logistics (Specialized Transportation Group)',
  'Sunset Transportation',
  'Swift Logistics (Knight-Swift)',
  'Synchro Logistics',
  'TForce Logistics',
  'TQL (Total Quality Logistics)',
  'Transfix',
  'Transplace (Uber Freight enterprise)',
  'Transport Investments / TI Logistics',
  'Trinity Logistics',
  'Tropic Transport',
  'Tucker Company Worldwide',
  'Turvo (platform, often used by brokers)',
  'Uber Freight',
  'Unishippers',
  'Universal Logistics Holdings (services)',
  'UPS Supply Chain Solutions',
  'U.S. Xpress Logistics (legacy)',
  'Varp Logistics',
  'Vertex Logistics',
  'Visigistics',
  'Werner Logistics',
  'Westwood Shipping Lines Logistics',
  'Worldwide Express',
  'XPO Logistics (managed freight)',
  'Yusen Logistics',
  'Zenith Logistics',
  'Zipline Logistics',
];

// ============================================================================
// Alias Map for Common Abbreviations
// ============================================================================

const BROKER_ALIASES: Record<string, string[]> = {
  'TQL (Total Quality Logistics)': ['TQL', 'Total Quality'],
  'J.B. Hunt 360 / Brokerage': ['JB', 'JB HUNT', 'J.B. HUNT', 'J B HUNT', 'JB Hunt'],
  'C.H. Robinson': ['CHRW', 'CH ROBINSON', 'CH ROB', 'CHR', 'Robinson'],
  'RXO (brokerage)': ['RXO'],
  'ArcBest / MoLo Solutions': ['ARCBEST', 'MOLO', 'MOLO SOLUTIONS'],
  'MoLo Solutions (ArcBest)': ['MOLO', 'ARCBEST'],
  'CHRW Managed Solutions': ['CHRW', 'CH ROBINSON'],
  'Freightquote (C.H. Robinson group)': ['FREIGHTQUOTE', 'CHRW'],
  'H. Robinson TMS (managed)': ['H ROBINSON', 'CHRW'],
  'Echo Global Logistics': ['ECHO', 'Echo Global'],
  'Coyote Logistics': ['COYOTE'],
  'XPO Logistics (managed freight)': ['XPO'],
  'Uber Freight': ['UBER', 'Uber'],
  'Amazon Freight': ['AMAZON', 'AMZ'],
  'Schneider Logistics / Brokerage': ['SCHNEIDER', 'SNI'],
  'Landstar Brokerage / Logistics': ['LANDSTAR', 'LSTR'],
  'Werner Logistics': ['WERNER'],
  'England Logistics': ['ENGLAND', 'CR ENGLAND'],
  'Knight Logistics': ['KNIGHT'],
  'Swift Logistics (Knight-Swift)': ['SWIFT', 'KNIGHT SWIFT'],
  'Arrive Logistics': ['ARRIVE'],
  'GlobalTranz': ['GLOBALTRANZ', 'GTZ'],
  'Nolan Transportation Group (NTG)': ['NTG', 'NOLAN'],
  'Redwood Logistics': ['REDWOOD'],
  'Mode Transportation': ['MODE'],
  'Spot Freight': ['SPOT'],
  'Loadsmart': ['LOADSMART'],
  'Transfix': ['TRANSFIX'],
  'Convoy (legacy brand)': ['CONVOY'],
  'Flexport': ['FLEXPORT'],
  'DHL Global Forwarding': ['DHL'],
  'FedEx Supply Chain Logistics': ['FEDEX'],
  'UPS Supply Chain Solutions': ['UPS'],
  'Penske Logistics': ['PENSKE'],
  'Ryder Supply Chain Solutions': ['RYDER'],
};

// ============================================================================
// Generate Customer from Broker Name
// ============================================================================

function generateCustomerFromBroker(name: string, index: number): CustomerEntity {
  const now = new Date().toISOString();
  const aliases = BROKER_ALIASES[name] || [];
  const searchKey = generateSearchKey(name, aliases);
  const prefixes = generatePrefixes(searchKey);

  return {
    id: `cust_broker_${String(index + 1).padStart(4, '0')}`,
    name: name,
    type: 'broker' as CustomerType,
    aliases: aliases.length > 0 ? aliases : undefined,
    searchKey: searchKey,
    prefixes: prefixes,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Generate All Broker Customers
// ============================================================================

export function generateBrokerCustomers(): CustomerEntity[] {
  return COMMON_BROKERS.map((name, index) => generateCustomerFromBroker(name, index));
}

// ============================================================================
// Auto-Seed Customers (Brokers) if Empty
// ============================================================================

export function autoSeedCustomers(tenantId: string | null): CustomerEntity[] {
  const getStorageKey = (key: string): string => {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    return `${prefix}${key}`;
  };

  const storageKey = getStorageKey('customers');

  try {
    // Check if customers already exist
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Customers already exist, return them
        return parsed;
      }
    }

    // No customers found, seed with brokers
    const customers = generateBrokerCustomers();
    localStorage.setItem(storageKey, JSON.stringify(customers));
    console.log(`✅ Auto-seeded ${customers.length} broker customers to ${storageKey}`);
    return customers;
  } catch (error) {
    console.error('Error auto-seeding customers:', error);
    return [];
  }
}

// ============================================================================
// Migrate Existing Brokers to Customers
// ============================================================================

export function migrateBrokersToCustomers(tenantId: string | null): CustomerEntity[] {
  const getStorageKey = (key: string): string => {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    return `${prefix}${key}`;
  };

  const brokersKey = getStorageKey('brokers');
  const customersKey = getStorageKey('customers');

  try {
    // Get existing brokers
    const brokersStored = localStorage.getItem(brokersKey);
    if (!brokersStored) {
      console.log('No existing brokers to migrate');
      return autoSeedCustomers(tenantId);
    }

    const brokers = JSON.parse(brokersStored);
    if (!Array.isArray(brokers) || brokers.length === 0) {
      console.log('No existing brokers to migrate');
      return autoSeedCustomers(tenantId);
    }

    // Check if customers already exist
    const customersStored = localStorage.getItem(customersKey);
    if (customersStored) {
      const existingCustomers = JSON.parse(customersStored);
      if (Array.isArray(existingCustomers) && existingCustomers.length > 0) {
        console.log('Customers already exist, skipping migration');
        return existingCustomers;
      }
    }

    // Convert brokers to customers
    const now = new Date().toISOString();
    const customers: CustomerEntity[] = brokers.map((broker: any, index: number) => ({
      id: broker.id || `cust_migrated_${String(index + 1).padStart(4, '0')}`,
      name: broker.name,
      type: 'broker' as CustomerType,
      aliases: broker.aliases,
      searchKey: broker.searchKey,
      prefixes: broker.prefixes,
      address: broker.address,
      city: broker.city,
      state: broker.state,
      zipCode: broker.zipCode,
      phone: broker.phone,
      email: broker.email,
      notes: broker.notes,
      isActive: true,
      createdAt: broker.createdAt || now,
      updatedAt: now,
    }));

    // Save migrated customers
    localStorage.setItem(customersKey, JSON.stringify(customers));
    console.log(`✅ Migrated ${customers.length} brokers to customers in ${customersKey}`);

    return customers;
  } catch (error) {
    console.error('Error migrating brokers to customers:', error);
    return autoSeedCustomers(tenantId);
  }
}

// ============================================================================
// Customer Search Utilities
// ============================================================================

export function searchCustomers(customers: CustomerEntity[], query: string): CustomerEntity[] {
  if (!query || query.trim().length === 0) {
    return customers;
  }

  const normalizedQuery = normalize(query);

  return customers.filter(customer => {
    // Check name
    if (customer.searchKey.includes(normalizedQuery)) {
      return true;
    }

    // Check prefixes
    if (customer.prefixes.some(prefix => prefix.startsWith(normalizedQuery))) {
      return true;
    }

    // Check aliases
    if (customer.aliases?.some(alias => normalize(alias).includes(normalizedQuery))) {
      return true;
    }

    return false;
  });
}

export function filterCustomersByType(customers: CustomerEntity[], types: CustomerType | CustomerType[]): CustomerEntity[] {
  const typeArray = Array.isArray(types) ? types : [types];
  return customers.filter(customer => typeArray.includes(customer.type));
}
