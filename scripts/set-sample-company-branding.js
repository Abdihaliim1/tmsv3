/**
 * Set Company Branding for Sample Trucking
 * Tenant: sample
 * 
 * This script sets the company settings for sample.asal.llc
 * Run this in the browser console when on sample.asal.llc
 * OR use it as a reference for setting company branding
 */

const sampleCompanySettings = {
  name: 'Sample Trucking',
  shortName: 'Sample',
  address: '1234 Highway 30',
  city: 'Des Moines',
  state: 'IA',
  zip: '50309',
  country: 'United States',
  phone: '(515) 555-0123',
  email: 'dispatch@sampletrucking.com',
  website: 'www.sampletrucking.com',
  dotNumber: '1234567',
  taxId: '12-3456789'
};

// Set for sample tenant
const tenantId = 'sample';
const storageKey = `tms_${tenantId}_company_settings`;

// Save to localStorage
localStorage.setItem(storageKey, JSON.stringify(sampleCompanySettings));

console.log('✅ Company branding set for Sample Trucking!');
console.log('Settings:', sampleCompanySettings);
console.log('Storage key:', storageKey);
console.log('\n📋 To verify, refresh the page and check the Settings page.');

// If running in browser, also update the current page if CompanyContext is available
if (typeof window !== 'undefined') {
  // Trigger a custom event to notify the app
  window.dispatchEvent(new CustomEvent('companySettingsUpdated', { 
    detail: sampleCompanySettings 
  }));
  
  console.log('\n🔄 Reload the page to see the changes.');
}

