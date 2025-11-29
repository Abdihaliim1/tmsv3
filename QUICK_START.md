# 🚀 Quick Start - Multi-Tenant TMS Deployment

## Your Goal: `company1.mydomain.com`, `company2.mydomain.com`, etc.

This guide will get you from zero to production in **30 minutes**.

---

## ✅ What You Get

- ✅ **Multi-tenant system** - Each company gets its own subdomain
- ✅ **Professional hosting** - Google Cloud Platform (commercial-grade)
- ✅ **SSL certificates** - Automatic HTTPS for all subdomains
- ✅ **Data isolation** - Each tenant's data is completely separate
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **99.9% uptime** - Enterprise-grade reliability

---

## 📋 Prerequisites (5 minutes)

1. **Google Cloud Account**
   - Sign up: https://cloud.google.com
   - Enable billing (free tier available)

2. **Domain Name**
   - Purchase from Google Domains, Namecheap, or GoDaddy
   - Example: `mydomain.com`

3. **Install Google Cloud SDK**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download: https://cloud.google.com/sdk/docs/install
   ```

4. **Login to Google Cloud**
   ```bash
   gcloud init
   gcloud auth login
   ```

---

## 🚀 Deployment Steps (25 minutes)

### Step 1: Create Project (2 min)

```bash
# Create project
gcloud projects create tms-production --name="TMS Production"
gcloud config set project tms-production

# Enable billing
# Go to: https://console.cloud.google.com/billing
```

### Step 2: Deploy Application (10 min)

```bash
# Set your project ID
export GCP_PROJECT_ID="tms-production"
export DOMAIN="mydomain.com"  # Your actual domain

# Deploy to Cloud Run
./scripts/deploy-production.sh
```

This will:
- Build your application
- Deploy to Google Cloud Run
- Set up auto-scaling
- Configure production settings

### Step 3: Set Up Load Balancer (10 min)

```bash
# Run the setup script
./scripts/setup-load-balancer.sh
```

This will:
- Reserve a static IP address
- Create SSL certificate (wildcard: `*.mydomain.com`)
- Set up load balancer
- Configure HTTPS

**Important**: When prompted, add the DNS record:
```
Type: A
Name: *
Value: [Load Balancer IP shown in script]
```

### Step 4: Configure DNS (3 min)

Add this DNS record to your domain provider:

```
Type    Name    Value
A       *       [Load Balancer IP from Step 3]
A       @       [Load Balancer IP]
CNAME   www     mydomain.com
```

### Step 5: Create First Tenant (1 min)

```bash
# Create your first company
./scripts/create-tenant.sh company1 "Company 1 Name"
```

### Step 6: Wait for SSL (10-60 min)

SSL certificate provisioning takes 10-60 minutes. Check status:

```bash
gcloud compute ssl-certificates describe tms-ssl-cert --global
```

When status shows `ACTIVE`, you're ready!

---

## 🎉 You're Live!

Access your TMS at:
- **Company 1**: `https://company1.mydomain.com`
- **Company 2**: `https://company2.mydomain.com` (after creating)

---

## 📝 Adding More Companies

```bash
# Create additional tenants
./scripts/create-tenant.sh company2 "Company 2 Name"
./scripts/create-tenant.sh company3 "Company 3 Name"
```

Each company gets:
- Its own subdomain
- Isolated data storage
- Separate user accounts
- Independent billing (if configured)

---

## 💰 Cost Estimate

**Monthly costs** (10 companies, moderate usage):
- Cloud Run: ~$0.40
- Firestore: ~$0.24
- Cloud Storage: ~$2.00
- Load Balancer: ~$18.00
- **Total: ~$20-25/month**

Scales linearly with usage.

---

## 🔧 Management Commands

### View Service Status
```bash
gcloud run services describe tms-app --region us-central1
```

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Deploy Updates
```bash
./scripts/deploy-production.sh
```

### Check SSL Status
```bash
gcloud compute ssl-certificates describe tms-ssl-cert --global
```

---

## 📚 Detailed Documentation

- **Full Setup Guide**: `docs/MULTI_TENANT_SETUP.md`
- **Production Guide**: `docs/PRODUCTION_SETUP.md`
- **Google Cloud Guide**: `docs/GOOGLE_CLOUD_DEPLOYMENT.md`

---

## 🆘 Troubleshooting

### SSL Certificate Not Ready
- Wait 10-60 minutes after creation
- Check DNS records are correct
- Verify domain ownership

### Subdomain Not Working
- Check DNS A record points to Load Balancer IP
- Verify SSL certificate is ACTIVE
- Check Cloud Run service is running

### Need Help?
- Check `docs/MULTI_TENANT_SETUP.md` for detailed troubleshooting
- Google Cloud Support: https://cloud.google.com/support

---

## ✅ Production Checklist

- [ ] Google Cloud project created
- [ ] Billing enabled
- [ ] Application deployed
- [ ] Load balancer configured
- [ ] DNS records added
- [ ] SSL certificate active
- [ ] First tenant created
- [ ] Tested access at `https://company1.mydomain.com`

---

**Ready?** Start with Step 1 above! 🚀

