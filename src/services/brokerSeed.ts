/**
 * Auto-seed brokers if they don't exist
 * This runs automatically when TMSContext initializes
 */

import { Broker } from '../types';
import { normalize, generatePrefixes, generateSearchKey } from './brokerUtils';

const BROKER_LIST = [
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

const ALIAS_MAP: Record<string, string[]> = {
  'TQL (Total Quality Logistics)': ['TQL', 'Total Quality'],
  'J.B. Hunt 360 / Brokerage': ['JB', 'JB HUNT', 'J.B. HUNT', 'J B HUNT'],
  'C.H. Robinson': ['CHRW', 'CH ROBINSON', 'CH ROB'],
  'RXO (brokerage)': ['RXO'],
  'ArcBest / MoLo Solutions': ['ARCBEST', 'MOLO', 'MOLO SOLUTIONS'],
  'MoLo Solutions (ArcBest)': ['MOLO', 'ARCBEST'],
  'CHRW Managed Solutions': ['CHRW', 'CH ROBINSON'],
  'Freightquote (C.H. Robinson group)': ['FREIGHTQUOTE', 'CHRW'],
  'H. Robinson TMS (managed)': ['H ROBINSON', 'CHRW'],
};

/**
 * Generate broker seed data
 */
export function generateBrokerSeed(): Broker[] {
  const brokers: Broker[] = [];
  const now = new Date().toISOString();

  BROKER_LIST.forEach((name, index) => {
    const aliases = ALIAS_MAP[name] || [];
    const searchKey = generateSearchKey(name, aliases);
    const prefixes = generatePrefixes(searchKey);

    brokers.push({
      id: `broker_${String(index + 1).padStart(4, '0')}`,
      name: name,
      aliases: aliases.length > 0 ? aliases : undefined,
      searchKey: searchKey,
      prefixes: prefixes,
      createdAt: now,
      updatedAt: now,
    });
  });

  return brokers;
}

/**
 * Auto-seed brokers if they don't exist in localStorage
 */
export function autoSeedBrokers(tenantId: string | null): Broker[] {
  const getStorageKey = (key: string): string => {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    return `${prefix}${key}`;
  };

  const storageKey = getStorageKey('brokers');

  try {
    // Check if brokers already exist
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Brokers already exist, return them
        return parsed;
      }
    }

    // No brokers found, seed them
    const brokers = generateBrokerSeed();
    localStorage.setItem(storageKey, JSON.stringify(brokers));
    console.log(`✅ Auto-seeded ${brokers.length} brokers to ${storageKey}`);
    return brokers;
  } catch (error) {
    console.error('Error auto-seeding brokers:', error);
    return [];
  }
}


