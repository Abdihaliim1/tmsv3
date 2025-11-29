# 🏢 Production Setup Guide - Multi-Tenant TMS

Complete guide for deploying a professional, commercial-grade multi-tenant TMS system.

## 🎯 Overview

This setup provides:
- ✅ **Multi-tenant architecture** with subdomain routing (company1.mydomain.com)
- ✅ **Professional hosting** on Google Cloud Platform
- ✅ **Commercial-grade** infrastructure with auto-scaling
- ✅ **Data isolation** per tenant
- ✅ **SSL certificates** for all subdomains
- ✅ **High availability** and reliability

---

## 📋 Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Domain name** (e.g., mydomain.com)
3. **Google Cloud SDK** installed
4. **Node.js 18+** installed

---

## 🚀 Quick Start (30 minutes)

### Step 1: Initial Setup (5 min)

```bash
# 1. Create Google Cloud project
gcloud projects create tms-production --name="TMS Production"
gcloud config set project tms-production

# 2. Enable billing
# Go to: https://console.cloud.google.com/billing

# 3. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  compute.googleapis.com \
  dns.googleapis.com
```

### Step 2: Deploy Application (10 min)

```bash
# Set project ID
export GCP_PROJECT_ID="tms-production"

# Deploy to Cloud Run
./scripts/deploy-production.sh
```

### Step 3: Set Up Load Balancer (10 min)

```bash
# Reserve static IP
gcloud compute addresses create tms-lb-ip --global

# Get the IP
LB_IP=$(gcloud compute addresses describe tms-lb-ip --global --format="value(address)")
echo "Add this IP to your DNS: $LB_IP"

# Create SSL certificate (takes 10-60 min to provision)
gcloud compute ssl-certificates create tms-ssl-cert \
  --domains="*.mydomain.com,mydomain.com" \
  --global

# Create backend service
gcloud compute network-endpoint-groups create tms-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=tms-app

gcloud compute backend-services create tms-backend \
  --global \
  --protocol=HTTP

gcloud compute backend-services add-backend tms-backend \
  --global \
  --network-endpoint-group=tms-neg \
  --network-endpoint-group-region=us-central1

# Create URL map and forwarding rules
gcloud compute url-maps create tms-url-map \
  --default-service=tms-backend \
  --global

gcloud compute target-https-proxies create tms-https-proxy \
  --url-map=tms-url-map \
  --ssl-certificates=tms-ssl-cert

gcloud compute forwarding-rules create tms-forwarding-rule \
  --global \
  --target-https-proxy=tms-https-proxy \
  --ports=443 \
  --address=$LB_IP
```

### Step 4: Configure DNS (5 min)

Add these DNS records to your domain provider:

```
Type    Name              Value
A       *                 [Load Balancer IP from Step 3]
A       @                 [Load Balancer IP]
CNAME   www               mydomain.com
```

### Step 5: Create First Tenant

```bash
# Create tenant
./scripts/create-tenant.sh company1 "Company 1 Name"

# Access at: https://company1.mydomain.com
```

---

## 💰 Pricing Estimate

### Monthly Costs (10 tenants, moderate usage)

| Service | Cost |
|---------|------|
| Cloud Run (1M requests) | $0.40 |
| Firestore (10GB, 1M reads) | $0.24 |
| Cloud Storage (100GB) | $2.00 |
| Load Balancer | $18.00 |
| SSL Certificate | Free |
| **Total** | **~$20-25/month** |

### Scaling Costs

- **50 tenants**: ~$30-40/month
- **100 tenants**: ~$50-70/month
- **500 tenants**: ~$150-200/month

---

## 🔒 Security Features

✅ **Data Isolation**: Each tenant's data is completely isolated  
✅ **SSL/TLS**: All traffic encrypted  
✅ **Firestore Security Rules**: Tenant-based access control  
✅ **Authentication**: Firebase Auth with custom claims  
✅ **HTTPS Only**: HTTP automatically redirects to HTTPS  

---

## 📊 Monitoring & Maintenance

### Set Up Monitoring

```bash
# Enable monitoring
gcloud services enable monitoring.googleapis.com logging.googleapis.com

# View logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Health Checks

- Cloud Run automatically handles health checks
- Load balancer monitors backend health
- Set up alerts in Cloud Monitoring

---

## 🔄 Updates & Maintenance

### Deploy Updates

```bash
# Simply run the deployment script again
./scripts/deploy-production.sh
```

### Zero-Downtime Updates

Cloud Run provides zero-downtime deployments automatically.

---

## 🆘 Support & Troubleshooting

### Common Issues

1. **SSL Certificate Not Ready**
   - Wait 10-60 minutes after creation
   - Check: `gcloud compute ssl-certificates describe tms-ssl-cert --global`

2. **Subdomain Not Working**
   - Verify DNS A record points to Load Balancer IP
   - Check URL map configuration
   - Verify Cloud Run service is running

3. **Tenant Data Not Loading**
   - Check Firestore security rules
   - Verify tenant detection in browser console
   - Check authentication setup

---

## 📚 Next Steps

1. **Customize Branding**: Add tenant-specific logos and colors
2. **Set Up Billing**: Integrate payment processing per tenant
3. **Add Monitoring**: Set up alerts and dashboards
4. **Backup Strategy**: Configure automated backups
5. **Admin Panel**: Build admin interface at admin.mydomain.com

---

**Ready to deploy?** Run `./scripts/deploy-production.sh` and follow the prompts!

