# 🌐 Custom Domain Setup: atsfreight.asal.llc

## Overview

Your domain `atsfreight.asal.llc` will work with your TMS Pro application. Here's how to set it up:

---

## 🎯 How It Works

### Current Setup
- **Cloud Run URL:** `https://tms-pro-664mzhdgfq-ew.a.run.app`
- **Your Domain:** `atsfreight.asal.llc`
- **Subdomain Detection:** The app will detect `atsfreight` as the tenant ID

### Multi-Tenant System
Your app supports multiple companies via subdomains:
- `atsfreight.asal.llc` → Tenant ID: `atsfreight`
- `company2.asal.llc` → Tenant ID: `company2`
- `company3.asal.llc` → Tenant ID: `company3`

Each subdomain gets its own isolated data!

---

## 📋 Step-by-Step Setup

### Step 1: Map Domain in Google Cloud Run

1. **Go to Cloud Run Console:**
   ```
   https://console.cloud.google.com/run
   ```

2. **Select Your Service:**
   - Click on `tms-pro` service
   - Go to the **"MANAGE CUSTOM DOMAINS"** tab

3. **Add Domain Mapping:**
   - Click **"ADD MAPPING"**
   - Enter: `atsfreight.asal.llc`
   - Select your service: `tms-pro`
   - Select region: `europe-west1`
   - Click **"CONTINUE"**

4. **Get DNS Records:**
   - Google will provide you with DNS records
   - You'll see something like:
     ```
     Type: CNAME
     Name: atsfreight.asal.llc
     Value: ghs.googlehosted.com
     ```
   - **OR** you might get an A record with an IP address

---

### Step 2: Configure DNS at Your Domain Registrar

Go to your domain registrar (where you bought `asal.llc`) and add DNS records:

#### Option A: CNAME Record (Recommended)

**If Google provides a CNAME:**
```
Type: CNAME
Name: atsfreight
Value: ghs.googlehosted.com (or the value Google provides)
TTL: 3600 (or auto)
```

#### Option B: A Record

**If Google provides an IP address:**
```
Type: A
Name: atsfreight
Value: [IP address from Google]
TTL: 3600
```

#### Option C: Wildcard (For Multiple Subdomains)

**To support multiple companies:**
```
Type: CNAME
Name: *
Value: ghs.googlehosted.com
TTL: 3600
```

This allows:
- `atsfreight.asal.llc`
- `company2.asal.llc`
- `company3.asal.llc`
- Any other subdomain

---

### Step 3: Wait for DNS Propagation

- **DNS Propagation:** 5-60 minutes (usually 15-30 minutes)
- **SSL Certificate:** 10-60 minutes (automatic by Google)

**Check DNS:**
```bash
# Check if DNS is resolving
dig atsfreight.asal.llc
# or
nslookup atsfreight.asal.llc
```

---

### Step 4: Verify Domain Mapping

1. **Check Status in Cloud Run:**
   - Go back to Cloud Run Console
   - Check domain mapping status
   - Should show "Active" when ready

2. **Test Access:**
   - Visit: `https://atsfreight.asal.llc`
   - Should redirect to your TMS application
   - SSL certificate should be active (green lock)

---

## 🔧 Using Command Line (Alternative Method)

If you prefer command line:

```bash
# Map domain to Cloud Run service
gcloud run domain-mappings create \
  --service tms-pro \
  --domain atsfreight.asal.llc \
  --region europe-west1

# Get DNS records
gcloud run domain-mappings describe atsfreight.asal.llc \
  --region europe-west1

# Check status
gcloud run domain-mappings list --region europe-west1
```

---

## 🎯 How Your Domain Will Work

### Access Patterns

1. **Direct Access:**
   ```
   https://atsfreight.asal.llc
   ```
   - Detects tenant: `atsfreight`
   - Shows login page
   - Data is isolated per tenant

2. **Login:**
   - Username: `Abdihaliim`
   - Password: `Abdi1234`
   - After login, you'll see the dashboard

3. **Data Isolation:**
   - All data stored with tenant ID: `atsfreight`
   - Company settings are tenant-specific
   - Other subdomains won't see your data

---

## 🌍 Multiple Companies Setup

If you want to add more companies:

### Example: Add Another Company

1. **Add DNS Record:**
   ```
   Type: CNAME
   Name: company2
   Value: ghs.googlehosted.com
   ```

2. **Map in Cloud Run:**
   ```bash
   gcloud run domain-mappings create \
     --service tms-pro \
     --domain company2.asal.llc \
     --region europe-west1
   ```

3. **Access:**
   - Visit: `https://company2.asal.llc`
   - Separate tenant with isolated data
   - Same login credentials (or configure separate)

---

## 🔒 SSL Certificate

- **Automatic:** Google provisions SSL automatically
- **Free:** Included with Cloud Run
- **Auto-renewal:** Handled by Google
- **Wait Time:** 10-60 minutes after DNS setup

**Check SSL:**
```bash
# Test SSL
openssl s_client -connect atsfreight.asal.llc:443 -servername atsfreight.asal.llc
```

---

## 🛠️ Troubleshooting

### Domain Not Resolving

1. **Check DNS Records:**
   ```bash
   dig atsfreight.asal.llc
   nslookup atsfreight.asal.llc
   ```

2. **Verify at Registrar:**
   - Log into your domain registrar
   - Check DNS records are saved
   - Wait for propagation (up to 24 hours)

3. **Check Cloud Run Mapping:**
   - Verify domain is mapped in Cloud Run console
   - Check status is "Active"

### SSL Certificate Issues

1. **Wait Longer:**
   - SSL provisioning can take up to 60 minutes
   - Check status in Cloud Run console

2. **Verify DNS:**
   - SSL won't provision if DNS isn't resolving
   - Ensure DNS records are correct

3. **Check Domain Verification:**
   - Google needs to verify domain ownership
   - This happens automatically for Cloud Run

### 404 Errors

1. **Check Service Status:**
   ```bash
   gcloud run services describe tms-pro --region europe-west1
   ```

2. **Verify Domain Mapping:**
   ```bash
   gcloud run domain-mappings describe atsfreight.asal.llc --region europe-west1
   ```

3. **Check nginx Configuration:**
   - Ensure SPA routing is configured
   - All routes should serve `index.html`

---

## 📊 Current Configuration

### Your Setup
- **Domain:** `atsfreight.asal.llc`
- **Tenant ID:** `atsfreight` (auto-detected from subdomain)
- **Service:** `tms-pro`
- **Region:** `europe-west1`
- **Cloud Run URL:** `https://tms-pro-664mzhdgfq-ew.a.run.app`

### After Setup
- **Your URL:** `https://atsfreight.asal.llc`
- **SSL:** Automatic (HTTPS)
- **Data Isolation:** Per tenant
- **Multi-tenant:** Ready for more companies

---

## ✅ Checklist

- [ ] Domain mapped in Cloud Run console
- [ ] DNS records added at registrar
- [ ] DNS propagation complete (check with `dig`)
- [ ] SSL certificate active (green lock in browser)
- [ ] Can access `https://atsfreight.asal.llc`
- [ ] Login works with credentials
- [ ] Data is isolated per tenant

---

## 🚀 Quick Commands

### Check Domain Status
```bash
gcloud run domain-mappings describe atsfreight.asal.llc --region europe-west1
```

### List All Mappings
```bash
gcloud run domain-mappings list --region europe-west1
```

### Delete Domain Mapping (if needed)
```bash
gcloud run domain-mappings delete atsfreight.asal.llc --region europe-west1
```

### Test DNS
```bash
dig atsfreight.asal.llc
nslookup atsfreight.asal.llc
```

---

## 💡 Pro Tips

1. **Use Wildcard DNS:**
   - Add `*.asal.llc` CNAME record
   - Allows any subdomain automatically
   - No need to add each subdomain separately

2. **Monitor Domain:**
   - Set up uptime monitoring
   - Use Google Cloud Monitoring
   - Get alerts if domain goes down

3. **Backup DNS:**
   - Document your DNS settings
   - Keep records of all mappings
   - Save DNS configuration

---

## 📞 Need Help?

1. **Check Cloud Run Logs:**
   ```bash
   gcloud run services logs read tms-pro --region europe-west1
   ```

2. **Google Cloud Support:**
   - Cloud Run Documentation
   - Domain Mapping Guide
   - DNS Troubleshooting

3. **Common Issues:**
   - DNS not propagating → Wait longer
   - SSL not ready → Wait up to 60 minutes
   - 404 errors → Check domain mapping status

---

## 🎉 After Setup

Once everything is configured:

1. ✅ Visit `https://atsfreight.asal.llc`
2. ✅ See login page
3. ✅ Login with: `Abdihaliim` / `Abdi1234`
4. ✅ Access your TMS dashboard
5. ✅ Configure company settings
6. ✅ Start using your TMS!

---

**Your domain `atsfreight.asal.llc` will work perfectly with your multi-tenant TMS system!** 🚀

