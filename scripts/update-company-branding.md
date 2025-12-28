# 🎨 Update Company Branding for Sample Trucking

## Quick Setup

### Option 1: Browser Console (Recommended)

1. **Visit:** `https://sample.asal.llc` (or `http://localhost:2811` if testing locally)
2. **Open Browser Console:** Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. **Go to Console tab**
4. **Copy and paste this code:**

```javascript
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

const tenantId = 'sample';
const storageKey = `tms_${tenantId}_company_settings`;
localStorage.setItem(storageKey, JSON.stringify(sampleCompanySettings));

console.log('✅ Company branding set for Sample Trucking!');
console.log('🔄 Reload the page to see changes.');
location.reload();
```

5. **Press Enter** to execute
6. **Page will reload** and show "Sample Trucking" branding

---

### Option 2: Use Settings Page

1. **Visit:** `https://sample.asal.llc`
2. **Login** with credentials
3. **Go to Settings page**
4. **Fill in:**
   - Company Name: `Sample Trucking`
   - Address: `1234 Highway 30`
   - City: `Des Moines`
   - State: `IA`
   - Zip: `50309`
   - Phone: `(515) 555-0123`
   - Email: `dispatch@sampletrucking.com`
   - Website: `www.sampletrucking.com`
   - DOT Number: `1234567`
5. **Click Save**
6. **Branding will be updated** for Sample Trucking only

---

## Company Details Set

- **Company Name:** Sample Trucking
- **Address:** 1234 Highway 30, Des Moines, IA 50309
- **Phone:** (515) 555-0123
- **Email:** dispatch@sampletrucking.com
- **Website:** www.sampletrucking.com
- **DOT Number:** 1234567

---

## Verification

After setting the branding:

1. **Check Sidebar:** Should show "Sample Trucking"
2. **Check Settings Page:** All company info should be filled
3. **Check PDFs:** Settlement PDFs will show "Sample Trucking" in header
4. **Check Invoices:** Will use Sample Trucking branding

---

## Tenant Isolation

✅ **This only affects `sample.asal.llc`**
- Other companies (like `atsfreight.asal.llc`) remain unchanged
- Each tenant has isolated company settings
- Storage key: `tms_sample_company_settings`

---

## For Other Companies

To set branding for other companies, use the same method but change:
- `tenantId = 'atsfreight'` (for atsfreight.asal.llc)
- `tenantId = 'company2'` (for company2.asal.llc)
- etc.

