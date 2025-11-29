# 🏢 How to Scale and Add New Company Portals - Explained

## 🎯 Simple Explanation

**Your TMS is like an apartment building:**
- **One building** (Cloud Run service) hosts **many apartments** (companies)
- Each apartment has its **own address** (subdomain: `company1.mydomain.com`)
- Each apartment is **completely separate** (isolated data)
- All apartments share the **same building infrastructure** (one deployment)

---

## 📊 Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Google Cloud Run Service (tms-pro)            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Company 1   │  │  Company 2   │  │  Company 3   │ │
│  │ company1.    │  │ company2.    │  │ company3.    │ │
│  │ mydomain.com │  │ mydomain.com │  │ mydomain.com │ │
│  │              │  │              │  │              │ │
│  │ Data:        │  │ Data:        │  │ Data:        │ │
│  │ - Loads      │  │ - Loads      │  │ - Loads      │ │
│  │ - Drivers    │  │ - Drivers    │  │ - Drivers    │ │
│  │ - Fleet      │  │ - Fleet      │  │ - Fleet      │ │
│  │ - Settings   │  │ - Settings   │  │ - Settings   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  All companies share the same codebase and service     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Add a New Company (Step-by-Step)

### **Step 1: Choose a Subdomain Name**

Think of this as choosing an apartment number.

**Examples:**
- `company1` → `company1.mydomain.com`
- `abc-transport` → `abc-transport.mydomain.com`
- `fleet-2024` → `fleet-2024.mydomain.com`

**Rules:**
- ✅ Lowercase letters, numbers, hyphens
- ✅ 3-63 characters
- ❌ No spaces, uppercase, or special characters

---

### **Step 2: Point DNS to Google Cloud**

This tells the internet: "When someone visits `company1.mydomain.com`, send them to Google Cloud."

**What to do:**
1. Go to your domain registrar (where you bought `mydomain.com`)
2. Add a DNS record:

**Option A: Wildcard (Recommended - Do Once)**
```
Type: CNAME
Name: *
Value: ghs.googlehosted.com
```
This makes **ALL** subdomains work automatically!

**Option B: Individual Record**
```
Type: CNAME
Name: company1
Value: ghs.googlehosted.com
```

**Wait:** 5-30 minutes for DNS to propagate

---

### **Step 3: Tell Google Cloud About the New Subdomain**

This connects the subdomain to your Cloud Run service.

**Via Google Cloud Console:**
1. Go to: https://console.cloud.google.com/run
2. Click on service: `tms-pro`
3. Click tab: **"MANAGE CUSTOM DOMAINS"**
4. Click: **"ADD MAPPING"**
5. Enter: `company1.mydomain.com`
6. Select service: `tms-pro`
7. Select region: `europe-west1`
8. Click: **"CONTINUE"**

**Via Command Line:**
```bash
export PATH="$HOME/google-cloud-sdk/google-cloud-sdk/bin:$PATH"
gcloud config set project somtms

gcloud run domain-mappings create \
  --service tms-pro \
  --domain company1.mydomain.com \
  --region europe-west1
```

**Wait:** 5-15 minutes for SSL certificate

---

### **Step 4: Test the New Portal**

1. Open browser
2. Go to: `https://company1.mydomain.com`
3. Should see the TMS application
4. If you see SSL error, wait a few more minutes

---

### **Step 5: Configure Company Settings**

1. In the TMS, go to **Settings** page
2. Fill in:
   - Company Name
   - Address
   - Phone, Email
   - DOT Number
   - Logo (optional)
3. Click **Save Company Settings**

**Done!** The company now has its own portal with its own branding.

---

## 🔐 How Data Isolation Works

### **Current System (LocalStorage)**

Each company's data is stored separately in the browser:

```
Browser Storage:
├── tms_company1_loads          (Company 1's loads)
├── tms_company1_drivers        (Company 1's drivers)
├── tms_company1_company_settings (Company 1's branding)
│
├── tms_company2_loads          (Company 2's loads)
├── tms_company2_drivers        (Company 2's drivers)
├── tms_company2_company_settings (Company 2's branding)
│
└── tms_company3_...            (Company 3's data)
```

**Key Point:** Company 1 **cannot** see Company 2's data because:
- Different localStorage keys (`tms_company1_*` vs `tms_company2_*`)
- Tenant ID extracted from subdomain
- App only loads data for current tenant

---

## 📈 Scaling Limits

### **Current Setup (LocalStorage)**

**Good For:**
- ✅ < 10 companies
- ✅ < 1,000 loads per company
- ✅ Small to medium businesses
- ✅ Quick setup, no database needed

**Limitations:**
- ⚠️ Browser storage limit (~5-10MB)
- ⚠️ Data only on one device
- ⚠️ Data lost if browser cleared
- ⚠️ Not suitable for large datasets

### **Future: Firestore Migration**

**Good For:**
- ✅ Unlimited companies
- ✅ Unlimited data
- ✅ Multi-device access
- ✅ Server-side backup
- ✅ Production-ready

**When to Migrate:**
- When you have > 10 companies
- When data exceeds browser limits
- When you need multi-device access
- When you need backups

---

## 🎨 What Each Company Can Customize

### **Company Settings (Per Tenant)**

Each company can set:
- ✅ Company Name
- ✅ Address, Phone, Email
- ✅ Logo
- ✅ DOT Number
- ✅ Tax ID

### **All Features Available**

Every company gets:
- ✅ Load Management
- ✅ Driver/Employee Management
- ✅ Fleet Management
- ✅ Expenses
- ✅ Settlements
- ✅ Reports
- ✅ Invoicing
- ✅ Account Receivables

**No feature restrictions** - all companies get everything!

---

## 🔄 Adding Multiple Companies at Once

### **Bulk Setup Script**

If you need to add 10+ companies:

```bash
#!/bin/bash
# add-multiple-companies.sh

COMPANIES=("company1" "company2" "company3" "abc-transport" "fleet-2024")
DOMAIN="mydomain.com"

for company in "${COMPANIES[@]}"; do
  echo "Adding $company.$DOMAIN..."
  
  gcloud run domain-mappings create \
    --service tms-pro \
    --domain $company.$DOMAIN \
    --region europe-west1 \
    --quiet
  
  echo "✅ $company.$DOMAIN added"
done
```

**Usage:**
```bash
chmod +x add-multiple-companies.sh
./add-multiple-companies.sh
```

---

## 🐛 Common Issues & Solutions

### **Issue: "Site can't be reached"**

**Problem:** DNS not configured or not propagated

**Solution:**
1. Check DNS records in domain registrar
2. Verify CNAME points to `ghs.googlehosted.com`
3. Wait 24-48 hours for DNS propagation
4. Test with: `dig company1.mydomain.com`

---

### **Issue: SSL Certificate Error**

**Problem:** SSL not provisioned yet

**Solution:**
1. Wait 15-30 minutes after domain mapping
2. Check certificate status in Cloud Console
3. Verify DNS records are correct
4. Clear browser cache

---

### **Issue: Wrong Company Data Showing**

**Problem:** Tenant ID not detected correctly

**Solution:**
1. Check browser console (F12) for tenant ID
2. Verify subdomain format (lowercase, no spaces)
3. Clear localStorage and refresh
4. Check `getTenantFromSubdomain()` function

---

## 📋 Quick Checklist

**Adding a New Company:**

- [ ] Choose subdomain name (lowercase, hyphens OK)
- [ ] Add DNS CNAME record (wildcard or individual)
- [ ] Map domain in Google Cloud Run
- [ ] Wait 5-30 minutes for DNS/SSL
- [ ] Test subdomain access
- [ ] Configure company settings
- [ ] Add initial data (drivers, trucks, loads)
- [ ] Verify data isolation
- [ ] Test branding (PDFs, invoices)

---

## 🎯 Real-World Example

**Scenario:** You want to add "ABC Transport LLC" as a new company.

**Steps:**
1. **Choose subdomain:** `abc-transport`
2. **Add DNS:** `* → ghs.googlehosted.com` (wildcard, already done)
3. **Map domain:** 
   ```bash
   gcloud run domain-mappings create \
     --service tms-pro \
     --domain abc-transport.mydomain.com \
     --region europe-west1
   ```
4. **Wait:** 10 minutes
5. **Access:** `https://abc-transport.mydomain.com`
6. **Configure:** Settings → Fill ABC Transport info → Save
7. **Done!** ABC Transport now has its own portal

**Result:**
- ✅ `abc-transport.mydomain.com` → ABC Transport's portal
- ✅ Completely separate data from other companies
- ✅ Custom branding (name, logo, address)
- ✅ All features available

---

## 💡 Key Takeaways

1. **One Deployment, Many Companies**
   - Single Cloud Run service hosts all companies
   - Each company gets its own subdomain
   - No need to deploy separately for each company

2. **Automatic Tenant Detection**
   - App detects company from subdomain
   - `company1.mydomain.com` → Tenant ID: `company1`
   - Data automatically isolated by tenant ID

3. **Easy to Add New Companies**
   - Just add DNS + domain mapping
   - No code changes needed
   - Takes 5-10 minutes per company

4. **Data Isolation**
   - Each company's data is separate
   - Company 1 cannot see Company 2's data
   - Stored with tenant prefix: `tms_company1_*`

5. **Scalable Architecture**
   - Current: Good for < 10 companies
   - Future: Migrate to Firestore for unlimited scale

---

## 📞 Need Help?

**Check These Files:**
- `docs/MULTI_TENANT_SCALING.md` - Detailed guide
- `QUICK_ADD_COMPANY.md` - Quick reference
- `DEPLOYMENT.md` - Deployment instructions

**Common Commands:**
```bash
# List all domain mappings
gcloud run domain-mappings list --region europe-west1

# Check service status
gcloud run services describe tms-pro --region europe-west1

# View logs
gcloud run services logs read tms-pro --region europe-west1 --limit 50
```

---

**Last Updated:** 2025-11-29

