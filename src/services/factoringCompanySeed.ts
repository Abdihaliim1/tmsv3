/**
 * Auto-seed factoring companies if they don't exist
 * This runs automatically when TMSContext initializes
 */

import { FactoringCompany } from '../types';
import { normalize, generatePrefixes, generateSearchKey } from './brokerUtils';

const FACTORING_COMPANY_LIST = [
  'Apex Capital Corp',
  'RTS Financial Service',
  'Triumph Business Capital',
  'TAFS (TransAm Financial Services)',
  'TBS Factoring Service, LLC',
  'OTR Capital',
  'eCapital (Freight Capital)',
  'Love\'s Financial / Love\'s Solutions, LLC',
  'Compass Funding Solutions',
  'Phoenix Capital Group',
  'Saint John Capital Corporation',
  'Financial Carrier Services',
  'Truckstop Factoring (ATS)',
  'Thunder Funding',
  'FirstLine Funding Group',
  'WEX Bank / Fleet One Factoring',
  'Multi Service Factoring',
  'Riviera Finance',
  'SouthStar Capital',
  'TAB Bank (Transportation Alliance Bank)',
  'Transport Factoring Inc',
  'Transport Financial Solutions',
  'Transportation Funding Group',
  'Wells Fargo Business Credit',
  'Wintrust Receivables Finance',
  'Republic Business Credit',
  'Security Business Capital',
  'Exchange Capital Corporation',
  'England Carrier Services',
  'Express Freight Finance',
  'Interstate Capital',
  'Openroad Financial Services',
  'Operation Finance (OperFi)',
  'LSQ Funding Group',
  'Bay View Funding Inc',
  'Bibby Transportation Finance',
  'Cashway Funding',
  'Catamount Funding Inc',
  'Crestmark (Crestmark Bank)',
  'Gulf Coast Business Credit',
  'Hitachi Business Finance',
  'Orange Commercial Credit',
  'Pine Street Factoring',
  'Power Funding, Ltd',
  'Quickpay Funding LLC',
  'Reliable Factors, Inc',
  'Sound Finance Corporation',
  'Sunbelt Finance LLC',
  'TCI Business Capital',
  'Vero Business Capital',
];

const ALIAS_MAP: Record<string, string[]> = {
  'TAFS (TransAm Financial Services)': ['TAFS', 'TRANSAM', 'TRANSAM FINANCIAL'],
  'TAB Bank (Transportation Alliance Bank)': ['TAB', 'TAB BANK', 'TRANSPORTATION ALLIANCE'],
  'TBS Factoring Service, LLC': ['TBS', 'TBS FACTORING'],
  'WEX Bank / Fleet One Factoring': ['WEX', 'WEX BANK', 'FLEET ONE'],
  'OTR Capital': ['OTR', 'OTR CAPITAL'],
  'Triumph Business Capital': ['TRIUMPH', 'TRIUMPH CAPITAL'],
  'RTS Financial Service': ['RTS', 'RTS FINANCIAL'],
  'Apex Capital Corp': ['APEX', 'APEX CAPITAL'],
  'eCapital (Freight Capital)': ['ECAPITAL', 'FREIGHT CAPITAL'],
  'Love\'s Financial / Love\'s Solutions, LLC': ['LOVES', 'LOVES FINANCIAL', 'LOVES SOLUTIONS'],
  'Truckstop Factoring (ATS)': ['TRUCKSTOP', 'ATS FACTORING'],
  'FirstLine Funding Group': ['FIRSTLINE', 'FIRST LINE'],
  'Multi Service Factoring': ['MULTI SERVICE', 'MULTISERVICE'],
  'Riviera Finance': ['RIVIERA'],
  'SouthStar Capital': ['SOUTHSTAR', 'SOUTH STAR'],
  'Wells Fargo Business Credit': ['WELLS FARGO', 'WELLS'],
  'Wintrust Receivables Finance': ['WINTRUST'],
  'Republic Business Credit': ['REPUBLIC'],
  'Security Business Capital': ['SECURITY BUSINESS', 'SECURITY'],
  'Exchange Capital Corporation': ['EXCHANGE CAPITAL', 'EXCHANGE'],
  'England Carrier Services': ['ENGLAND', 'ENGLAND CARRIER'],
  'Express Freight Finance': ['EXPRESS FREIGHT', 'EXPRESS'],
  'Interstate Capital': ['INTERSTATE'],
  'Openroad Financial Services': ['OPENROAD', 'OPEN ROAD'],
  'Operation Finance (OperFi)': ['OPERFI', 'OPERATION FINANCE'],
  'LSQ Funding Group': ['LSQ'],
  'Bay View Funding Inc': ['BAY VIEW', 'BAYVIEW'],
  'Bibby Transportation Finance': ['BIBBY'],
  'Cashway Funding': ['CASHWAY'],
  'Catamount Funding Inc': ['CATAMOUNT'],
  'Crestmark (Crestmark Bank)': ['CRESTMARK', 'CRESTMARK BANK'],
  'Gulf Coast Business Credit': ['GULF COAST'],
  'Hitachi Business Finance': ['HITACHI'],
  'Orange Commercial Credit': ['ORANGE'],
  'Pine Street Factoring': ['PINE STREET'],
  'Power Funding, Ltd': ['POWER FUNDING', 'POWER'],
  'Quickpay Funding LLC': ['QUICKPAY', 'QUICK PAY'],
  'Reliable Factors, Inc': ['RELIABLE', 'RELIABLE FACTORS'],
  'Sound Finance Corporation': ['SOUND FINANCE', 'SOUND'],
  'Sunbelt Finance LLC': ['SUNBELT'],
  'TCI Business Capital': ['TCI'],
  'Vero Business Capital': ['VERO'],
};

/**
 * Generate factoring company seed data
 */
export function generateFactoringCompanySeed(): FactoringCompany[] {
  const companies: FactoringCompany[] = [];
  const now = new Date().toISOString();

  FACTORING_COMPANY_LIST.forEach((name, index) => {
    const aliases = ALIAS_MAP[name] || [];
    const searchKey = generateSearchKey(name, aliases);
    const prefixes = generatePrefixes(searchKey);

    companies.push({
      id: `factoring_${String(index + 1).padStart(4, '0')}`,
      name: name,
      aliases: aliases.length > 0 ? aliases : undefined,
      searchKey: searchKey,
      prefixes: prefixes,
      createdAt: now,
      updatedAt: now,
    });
  });

  return companies;
}

/**
 * Auto-seed factoring companies if they don't exist in localStorage
 */
export function autoSeedFactoringCompanies(tenantId: string | null): FactoringCompany[] {
  const getStorageKey = (key: string): string => {
    const prefix = tenantId ? `tms_${tenantId}_` : 'tms_';
    return `${prefix}${key}`;
  };

  const storageKey = getStorageKey('factoringCompanies');

  try {
    // Check if companies already exist
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Companies already exist, return them
        return parsed;
      }
    }

    // No companies found, seed them
    const companies = generateFactoringCompanySeed();
    localStorage.setItem(storageKey, JSON.stringify(companies));
    console.log(`✅ Auto-seeded ${companies.length} factoring companies to ${storageKey}`);
    return companies;
  } catch (error) {
    console.error('Error auto-seeding factoring companies:', error);
    return [];
  }
}

