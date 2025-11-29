# 🏢 Multi-Tenant Scaling Guide - Adding New Company Portals

## 📋 Overview

TMS Pro is built with **multi-tenant architecture** that allows you to host multiple companies on a single deployment. Each company gets its own subdomain and completely isolated data.

**Current Setup:**
- ✅ Single Cloud Run service
- ✅ Subdomain-based tenant detection
- ✅ Tenant-aware data storage (localStorage)
- ✅ Company-specific branding

---

## 🎯 How It Works

### Architecture Flow

```
company1.mydomain.com  →  Cloud Run Service  →  Tenant ID: "company1"  →  Isolated Data
company2.mydomain.com  →  Cloud Run Service  →  Tenant ID: "company2"  →  Isolated Data
company3.mydomain.com  →  Cloud Run Service  →  Tenant ID: "company3"  →  Isolated Data
```

### Key Components

1. **Tenant Detection** (`src/utils/tenant.ts`)
   - Extracts tenant ID from subdomain
   - `company1.mydomain.com` → `tenantId: "company1"`

2. **Tenant Context** (`src/context/TenantContext.tsx`)
   - Provides tenant ID to entire app
   - Loads tenant configuration

3. **Company Context** (`src/context/CompanyContext.tsx`)
   - Stores company settings per tenant
   - Uses tenant-aware localStorage keys: `tms_company1_company_settings`

4. **Data Isolation** (`src/context/TMSContext.tsx`)
   - All data stored with tenant prefix
   - `tms_company1_loads`, `tms_company1_drivers`, etc.

---

## 🚀 Step-by-Step: Adding a New Company Portal

### Step 1: Choose Subdomain Name

**Rules:**
- ✅ 3-63 characters
- ✅ Lowercase letters, numbers, hyphens only
- ✅ Must start and end with letter or number
- ❌ No spaces, special characters, or uppercase

**Examples:**
- ✅ `company1`, `abc-transport`, `fleet-2024`
- ❌ `Company1`, `abc_transport`, `my company`

---

### Step 2: Configure DNS (Domain Registrar)

**Option A: Wildcard Subdomain (Recommended)**

Add a **wildcard CNAME** record to handle all subdomains automatically:

```
Type: CNAME
Name: *
Value: ghs.googlehosted.com
TTL: 3600
```

**This allows ANY subdomain to work:**
- `company1.mydomain.com` ✅
- `company2.mydomain.com` ✅
- `any-name.mydomain.com` ✅

**Option B: Individual Subdomain Records**

If you prefer explicit control, add individual CNAME records:

```
Type: CNAME
Name: company1
Value: ghs.googlehosted.com
TTL: 3600

Type: CNAME
Name: company2
Value: ghs.googlehosted.com
TTL: 3600
```

**DNS Propagation:**
- Usually takes 5-30 minutes
- Can take up to 48 hours in rare cases
- Use `dig company1.mydomain.com` to verify

---

### Step 3: Map Domain in Google Cloud Run

**Via Google Cloud Console:**

1. **Navigate to Cloud Run:**
   - Go to: https://console.cloud.google.com/run
   - Select project: `somtms`
   - Click on service: `tms-pro`

2. **Add Domain Mapping:**
   - Click **"MANAGE CUSTOM DOMAINS"** tab
   - Click **"ADD MAPPING"**
   - Enter domain: `company1.mydomain.com`
   - Select service: `tms-pro`
   - Select region: `europe-west1`
   - Click **"CONTINUE"**

3. **Verify DNS Records:**
   - Google will show required DNS records
   - Copy the CNAME record value
   - Add to your domain registrar (if not using wildcard)

4. **Wait for SSL Certificate:**
   - Google automatically provisions SSL
   - Takes 5-15 minutes
   - Status shows "Active" when ready

**Via Command Line:**

```bash
# Set project
gcloud config set project somtms

# Map domain to service
gcloud run domain-mappings create \
  --service tms-pro \
  --domain company1.mydomain.com \
  --region europe-west1

# Verify mapping
gcloud run domain-mappings describe company1.mydomain.com --region europe-west1
```

---

### Step 4: Test Subdomain Access

1. **Wait for DNS propagation** (5-30 minutes)
2. **Access the subdomain:**
   ```
   https://company1.mydomain.com
   ```
3. **Verify tenant detection:**
   - Open browser console (F12)
   - Check for tenant ID in localStorage
   - Should see: `tms_company1_company_settings`

---

### Step 5: Configure Company Settings

1. **Access Settings Page:**
   - Navigate to **Settings** in the sidebar
   - Or go to: `https://company1.mydomain.com` → Settings

2. **Fill Company Information:**
   - Company Name: `ABC Transport LLC`
   - Address: `123 Main St`
   - City, State, ZIP
   - Phone, Email, Website
   - DOT Number
   - Logo URL (optional)

3. **Save Settings:**
   - Click **"Save Company Settings"**
   - Settings stored in: `localStorage['tms_company1_company_settings']`

4. **Verify Branding:**
   - Check sidebar shows company name
   - Generate a settlement PDF → should show company info
   - Print an invoice → should show company info

---

### Step 6: Initialize Company Data

**First-Time Setup:**

1. **Add Drivers/Employees:**
   - Go to **Drivers** page
   - Click **"Add New Employee"**
   - Fill in driver information
   - Data stored as: `tms_company1_employees`

2. **Add Fleet:**
   - Go to **Fleet** page
   - Add trucks and trailers
   - Data stored as: `tms_company1_trucks`, `tms_company1_trailers`

3. **Create First Load:**
   - Go to **Loads** page
   - Click **"Create New Load"**
   - Fill in load details
   - Data stored as: `tms_company1_loads`

**Data Isolation:**
- Each company's data is completely separate
- Company1 cannot see Company2's data
- All localStorage keys are prefixed with tenant ID

---

## 🔄 Adding Multiple Companies (Bulk Setup)

### Quick Setup Script

Create a script to add multiple companies at once:

```bash
#!/bin/bash
# add-companies.sh

COMPANIES=("company1" "company2" "company3" "abc-transport" "fleet-2024")
DOMAIN="mydomain.com"
REGION="europe-west1"
SERVICE="tms-pro"

for company in "${COMPANIES[@]}"; do
  echo "Adding $company.$DOMAIN..."
  
  gcloud run domain-mappings create \
    --service $SERVICE \
    --domain $company.$DOMAIN \
    --region $REGION \
    --quiet
  
  echo "✅ $company.$DOMAIN mapped"
done

echo "✅ All companies added!"
```

**Usage:**
```bash
chmod +x add-companies.sh
./add-companies.sh
```

---

## 📊 Data Structure Per Tenant

### LocalStorage Keys (Current Implementation)

```
tms_company1_company_settings    → Company branding/info
tms_company1_loads              → All loads
tms_company1_employees          → Drivers, dispatchers, etc.
tms_company1_trucks             → Fleet trucks
tms_company1_trailers           → Trailers
tms_company1_expenses           → Company expenses
tms_company1_invoices           → Invoices
tms_company1_settlements        → Driver/dispatcher settlements
tms_company1_factoringCompanies → Factoring companies
```

### Future: Firestore Structure (When Migrated)

```
tenants/
  company1/
    loads/
      load-001/
    employees/
      emp-001/
    trucks/
      truck-001/
    settings/
      company/
```

---

## 🔐 Security & Isolation

### Current Implementation (LocalStorage)

**Isolation Level:** ✅ **Strong**
- Each tenant's data stored separately
- No cross-tenant access possible
- Tenant ID extracted from subdomain only

**Limitations:**
- Data stored in browser (client-side)
- Not suitable for production with sensitive data
- No server-side validation

### Recommended: Firestore Migration

**For Production:**
1. Migrate to Firestore with tenant prefixes
2. Implement Firebase Security Rules
3. Add server-side tenant validation
4. Implement authentication per tenant

**Example Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.token.tenantId == tenantId;
    }
  }
}
```

---

## 🎨 Customization Per Company

### Company-Specific Settings

Each company can customize:

1. **Branding:**
   - Company name
   - Logo
   - Address, contact info

2. **Business Settings:**
   - DOT Number
   - Tax ID
   - Currency (future)
   - Timezone (future)

3. **Features:**
   - All features available to all companies
   - No feature restrictions currently

### White-Label Options (Future)

- Custom color schemes
- Custom domain per company
- Custom email templates
- Custom PDF templates

---

## 📈 Scaling Considerations

### Current Limits

**Google Cloud Run:**
- ✅ Handles unlimited subdomains
- ✅ Auto-scales based on traffic
- ✅ No per-tenant resource limits

**LocalStorage:**
- ⚠️ Browser storage limit: ~5-10MB per domain
- ⚠️ Not suitable for large datasets
- ⚠️ Data lost if browser cleared

### Recommended Scaling Path

**Phase 1: Current (LocalStorage)**
- ✅ Good for: < 10 companies, < 1000 loads each
- ✅ Fast setup, no database needed
- ⚠️ Limited by browser storage

**Phase 2: Firestore Migration**
- ✅ Good for: Unlimited companies, unlimited data
- ✅ Server-side storage, backup, sync
- ✅ Multi-device access
- ⚠️ Requires Firebase setup

**Phase 3: Enterprise Features**
- ✅ Custom domains per company
- ✅ Advanced authentication
- ✅ API access per tenant
- ✅ Billing per tenant

---

## 🧪 Testing Multi-Tenant Setup

### Test Checklist

**For Each New Company:**

- [ ] DNS resolves correctly
- [ ] SSL certificate active
- [ ] Subdomain loads application
- [ ] Tenant ID detected correctly
- [ ] Company settings save/load
- [ ] Data isolation works (cannot see other company's data)
- [ ] Branding appears correctly
- [ ] PDFs show correct company info
- [ ] Invoices show correct company info

### Test Script

```bash
#!/bin/bash
# test-tenant.sh

COMPANY="company1"
DOMAIN="mydomain.com"
URL="https://$COMPANY.$DOMAIN"

echo "Testing $URL..."

# Check DNS
echo "1. Checking DNS..."
dig +short $COMPANY.$DOMAIN

# Check SSL
echo "2. Checking SSL..."
curl -I $URL 2>&1 | grep -i "HTTP\|SSL"

# Check tenant detection
echo "3. Testing tenant detection..."
curl -s $URL | grep -o "tenantId.*" | head -1

echo "✅ Tests complete"
```

---

## 🐛 Troubleshooting

### Issue: Subdomain Not Resolving

**Symptoms:**
- `company1.mydomain.com` shows "Site can't be reached"

**Solutions:**
1. Check DNS records in domain registrar
2. Verify CNAME points to `ghs.googlehosted.com`
3. Wait 24-48 hours for DNS propagation
4. Use `dig company1.mydomain.com` to verify

---

### Issue: SSL Certificate Not Working

**Symptoms:**
- Browser shows "Not Secure" or SSL error

**Solutions:**
1. Wait 15-30 minutes after domain mapping
2. Check certificate status in Cloud Console
3. Verify DNS records are correct
4. Clear browser cache

---

### Issue: Wrong Tenant Detected

**Symptoms:**
- `company1.mydomain.com` shows Company2's data

**Solutions:**
1. Check browser console for tenant ID
2. Verify `getTenantFromSubdomain()` logic
3. Clear localStorage and refresh
4. Check subdomain format (lowercase, no spaces)

---

### Issue: Company Settings Not Saving

**Symptoms:**
- Settings page doesn't save changes

**Solutions:**
1. Check browser console for errors
2. Verify localStorage is enabled
3. Check tenant ID is correctly detected
4. Clear browser cache and try again

---

## 📝 Quick Reference

### Add New Company (5 Steps)

1. **Choose subdomain:** `newcompany`
2. **Add DNS:** Wildcard CNAME `* → ghs.googlehosted.com` (or individual)
3. **Map domain:** `gcloud run domain-mappings create --domain newcompany.mydomain.com`
4. **Wait:** 5-30 minutes for DNS/SSL
5. **Configure:** Access `https://newcompany.mydomain.com` → Settings → Fill info

### Verify Company Setup

```bash
# Check domain mapping
gcloud run domain-mappings list --region europe-west1

# Check service status
gcloud run services describe tms-pro --region europe-west1

# View logs
gcloud run services logs read tms-pro --region europe-west1 --limit 50
```

---

## 🎯 Best Practices

1. **Use Wildcard DNS:**
   - Set up `* → ghs.googlehosted.com` once
   - All subdomains work automatically

2. **Naming Convention:**
   - Use lowercase, hyphens for spaces
   - Keep subdomains short and memorable
   - Document company → subdomain mapping

3. **Documentation:**
   - Keep a list of all companies and subdomains
   - Document any custom configurations
   - Track which companies are active

4. **Monitoring:**
   - Set up alerts for service downtime
   - Monitor Cloud Run usage
   - Track per-tenant usage (future)

5. **Backup Strategy:**
   - Export company data regularly
   - Keep backups of company settings
   - Document data export process

---

## 🚀 Next Steps

1. ✅ **Current:** LocalStorage-based multi-tenancy
2. 🔄 **Next:** Migrate to Firestore for production
3. 🔄 **Future:** Add authentication per tenant
4. 🔄 **Future:** Add billing per tenant
5. 🔄 **Future:** Add admin dashboard for managing tenants

---

## 📞 Support

**For Issues:**
1. Check Cloud Run logs
2. Verify DNS configuration
3. Test tenant detection
4. Review company settings
5. Check browser console for errors

**Common Commands:**
```bash
# List all domain mappings
gcloud run domain-mappings list --region europe-west1

# Describe specific mapping
gcloud run domain-mappings describe company1.mydomain.com --region europe-west1

# View service logs
gcloud run services logs read tms-pro --region europe-west1 --limit 100
```

---

**Last Updated:** 2025-11-29
**Version:** 2.0.0

