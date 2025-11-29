# ⚡ Quick Guide: Adding a New Company Portal

## 🎯 5-Minute Setup

### Step 1: Choose Subdomain
Pick a name: `company1`, `abc-transport`, `fleet-2024`
- ✅ Lowercase, numbers, hyphens only
- ❌ No spaces or special characters

### Step 2: Add DNS Record (Domain Registrar)

**Option A: Wildcard (Recommended - Do Once)**
```
Type: CNAME
Name: *
Value: ghs.googlehosted.com
```

**Option B: Individual Record**
```
Type: CNAME
Name: company1
Value: ghs.googlehosted.com
```

### Step 3: Map Domain in Google Cloud

**Via Console:**
1. Go to: https://console.cloud.google.com/run
2. Click service: `tms-pro`
3. Click "MANAGE CUSTOM DOMAINS"
4. Click "ADD MAPPING"
5. Enter: `company1.mydomain.com`
6. Select service: `tms-pro`
7. Click "CONTINUE"

**Via Command Line:**
```bash
export PATH="$HOME/google-cloud-sdk/google-cloud-sdk/bin:$PATH"
gcloud config set project somtms
gcloud run domain-mappings create \
  --service tms-pro \
  --domain company1.mydomain.com \
  --region europe-west1
```

### Step 4: Wait & Test
- ⏱️ Wait 5-30 minutes for DNS/SSL
- 🌐 Access: `https://company1.mydomain.com`
- ✅ Should load the TMS application

### Step 5: Configure Company
1. Go to **Settings** page
2. Fill in company information
3. Click **Save Company Settings**
4. Done! 🎉

---

## 🔍 Verify It Works

```bash
# Check domain mapping
gcloud run domain-mappings list --region europe-west1

# Test DNS
dig company1.mydomain.com

# Check SSL
curl -I https://company1.mydomain.com
```

---

## 📋 Current Service URL

**Cloud Run Service:**
- URL: `https://tms-pro-253655645250.europe-west1.run.app`
- Region: `europe-west1`
- Project: `somtms`

---

## 🚨 Troubleshooting

**Subdomain not working?**
- Check DNS records (wait 24-48 hours)
- Verify domain mapping in Cloud Run
- Check SSL certificate status

**Wrong company data showing?**
- Clear browser localStorage
- Verify tenant ID in browser console
- Check subdomain format (lowercase)

---

**Need more details?** See `docs/MULTI_TENANT_SCALING.md`

