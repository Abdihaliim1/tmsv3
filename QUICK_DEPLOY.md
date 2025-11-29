# 🚀 Quick Deployment Guide

## Step 1: Push to GitHub

```bash
# Add all changes
git add .

# Commit
git commit -m "feat: Multi-tenant ready - removed branding, added company settings"

# Push
git push origin main
```

## Step 2: Deploy to Google Cloud

```bash
# Option A: Use deployment script
./deploy.sh

# Option B: Manual deployment
npm run build
gcloud builds submit --tag gcr.io/somtms/tms-pro
gcloud run deploy tms-pro \
  --image gcr.io/somtms/tms-pro \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 80
```

## Step 3: Configure Domain

1. **In Google Cloud Console:**
   - Go to Cloud Run → Manage Custom Domains
   - Add your domain: `mydomain.com`
   - Add subdomains: `company1.mydomain.com`, `company2.mydomain.com`, etc.

2. **In Your Domain Registrar:**
   - Add A record: `@ → [Google Cloud IP]`
   - Add CNAME: `* → ghs.googlehosted.com` (wildcard for all subdomains)

3. **Wait for SSL:**
   - Google Cloud automatically provisions SSL certificates
   - Wait 5-15 minutes

## Step 4: Configure Company Settings

1. Access via subdomain: `https://company1.mydomain.com`
2. Go to **Settings** page
3. Fill in company information
4. Save

## Done! ✅

Your multi-tenant TMS is now live!

