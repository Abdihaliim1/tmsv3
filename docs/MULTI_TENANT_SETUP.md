# 🏢 Multi-Tenant Setup Guide

Professional multi-tenant TMS system with subdomain routing (company1.mydomain.com, company2.mydomain.com, etc.)

## 🎯 Architecture Overview

### Multi-Tenant Model
- **Subdomain Routing**: Each company gets its own subdomain (company1.mydomain.com)
- **Data Isolation**: Each tenant has isolated data
- **Shared Infrastructure**: Single deployment, multiple tenants
- **Professional Hosting**: Google Cloud Run with Load Balancer

### Technology Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Google Cloud Run
- **Database**: Cloud Firestore (with tenant isolation)
- **Domain**: Google Cloud Load Balancer with SSL
- **Storage**: Cloud Storage (per-tenant buckets)

---

## 🚀 Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project

```bash
# Create new project
gcloud projects create tms-production --name="TMS Production"

# Set as active project
gcloud config set project tms-production

# Enable billing (required)
# Go to: https://console.cloud.google.com/billing
```

### 1.2 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  compute.googleapis.com \
  dns.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 1.3 Set Up Firestore Database

```bash
# Create Firestore database (Native mode)
gcloud firestore databases create --location=us-central

# Or use the console:
# https://console.cloud.google.com/firestore
```

---

## 🌐 Step 2: Domain & DNS Configuration

### 2.1 Purchase Domain (if needed)

- Purchase domain from Google Domains, Namecheap, or GoDaddy
- Example: `mydomain.com`

### 2.2 Configure DNS

#### Option A: Google Cloud DNS (Recommended)

```bash
# Create DNS zone
gcloud dns managed-zones create tms-zone \
  --dns-name=mydomain.com \
  --description="TMS Multi-tenant DNS"

# Get name servers
gcloud dns managed-zones describe tms-zone --format="value(nameServers)"

# Add these name servers to your domain registrar
```

#### Option B: External DNS Provider

Add these DNS records to your domain provider:

```
Type    Name              Value
A       *                 [Load Balancer IP] (will get after setup)
A       @                 [Load Balancer IP]
CNAME   www               mydomain.com
```

### 2.3 Reserve Static IP

```bash
# Reserve global IP for load balancer
gcloud compute addresses create tms-lb-ip \
  --global \
  --ip-version=IPV4

# Get the IP
gcloud compute addresses describe tms-lb-ip --global --format="value(address)"
```

---

## 🏗️ Step 3: Multi-Tenant Application Setup

### 3.1 Tenant Management Structure

Each tenant (company) will have:
- Unique subdomain (company1.mydomain.com)
- Isolated Firestore collection
- Separate Cloud Storage bucket
- Custom branding (optional)

### 3.2 Update Application Code

The application needs to:
1. Detect tenant from subdomain
2. Route requests to tenant-specific data
3. Isolate data per tenant

---

## 🐳 Step 4: Deploy to Cloud Run

### 4.1 Build and Deploy

```bash
# Build the application
npm run build

# Deploy to Cloud Run
gcloud run deploy tms-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars="ENVIRONMENT=production"
```

### 4.2 Get Service URL

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe tms-app \
  --region us-central1 \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"
```

---

## 🔒 Step 5: Load Balancer & SSL Setup

### 5.1 Create SSL Certificate

```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create tms-ssl-cert \
  --domains="*.mydomain.com,mydomain.com" \
  --global

# Note: Certificate provisioning takes 10-60 minutes
# Check status:
gcloud compute ssl-certificates describe tms-ssl-cert --global
```

### 5.2 Create Backend Service

```bash
# Create serverless NEG (Network Endpoint Group)
gcloud compute network-endpoint-groups create tms-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=tms-app

# Create backend service
gcloud compute backend-services create tms-backend \
  --global \
  --protocol=HTTP \
  --port-name=http \
  --enable-cdn

# Add NEG to backend service
gcloud compute backend-services add-backend tms-backend \
  --global \
  --network-endpoint-group=tms-neg \
  --network-endpoint-group-region=us-central1
```

### 5.3 Create URL Map

```bash
# Create URL map
gcloud compute url-maps create tms-url-map \
  --default-service=tms-backend \
  --global
```

### 5.4 Create HTTPS Proxy

```bash
# Create HTTPS proxy
gcloud compute target-https-proxies create tms-https-proxy \
  --url-map=tms-url-map \
  --ssl-certificates=tms-ssl-cert
```

### 5.5 Create Forwarding Rule

```bash
# Get reserved IP
LB_IP=$(gcloud compute addresses describe tms-lb-ip --global --format="value(address)")

# Create forwarding rule
gcloud compute forwarding-rules create tms-forwarding-rule \
  --global \
  --target-https-proxy=tms-https-proxy \
  --ports=443 \
  --address=$LB_IP
```

### 5.6 Create HTTP to HTTPS Redirect

```bash
# Create HTTP proxy
gcloud compute target-http-proxies create tms-http-proxy \
  --url-map=tms-url-map

# Create HTTP forwarding rule (redirects to HTTPS)
gcloud compute forwarding-rules create tms-http-forwarding-rule \
  --global \
  --target-http-proxy=tms-http-proxy \
  --ports=80 \
  --address=$LB_IP
```

---

## 🗄️ Step 6: Firestore Multi-Tenant Structure

### 6.1 Database Schema

```
/tenants/{tenantId}
  - name: "Company 1"
  - subdomain: "company1"
  - domain: "company1.mydomain.com"
  - createdAt: timestamp
  - status: "active"
  - settings: {...}

/tenants/{tenantId}/loads/{loadId}
/tenants/{tenantId}/drivers/{driverId}
/tenants/{tenantId}/invoices/{invoiceId}
/tenants/{tenantId}/expenses/{expenseId}
/tenants/{tenantId}/settlements/{settlementId}
/tenants/{tenantId}/trucks/{truckId}
```

### 6.2 Security Rules

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to get tenant ID
    function getTenantId() {
      return request.auth.token.tenantId;
    }
    
    // Tenant collection
    match /tenants/{tenantId} {
      allow read: if request.auth != null && 
                     (request.auth.token.tenantId == tenantId || 
                      request.auth.token.admin == true);
      allow write: if request.auth != null && 
                      request.auth.token.admin == true;
    }
    
    // Tenant data collections
    match /tenants/{tenantId}/{collection}/{documentId=**} {
      allow read, write: if request.auth != null && 
                            request.auth.token.tenantId == tenantId;
    }
  }
}
```

---

## 💾 Step 7: Cloud Storage Multi-Tenant Setup

### 7.1 Create Storage Buckets (Per Tenant)

```bash
# Create bucket for tenant files
gsutil mb -p tms-production -c STANDARD -l us-central1 gs://tms-tenant-files

# Set CORS (if needed)
gsutil cors set cors.json gs://tms-tenant-files
```

### 7.2 Storage Structure

```
gs://tms-tenant-files/
  company1/
    documents/
    receipts/
    invoices/
  company2/
    documents/
    receipts/
    invoices/
```

---

## 🔐 Step 8: Authentication Setup

### 8.1 Firebase Authentication

```bash
# Enable Firebase Authentication
# Go to: https://console.cloud.google.com/apis/api/identitytoolkit.googleapis.com
```

### 8.2 Custom Claims for Tenant Isolation

Users will have custom claims:
```json
{
  "tenantId": "company1",
  "role": "admin|manager|user",
  "permissions": [...]
}
```

---

## 📝 Step 9: Application Code Updates

### 9.1 Tenant Detection

The app needs to detect tenant from subdomain:

```typescript
// src/utils/tenant.ts
export const getTenantFromSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // company1.mydomain.com -> company1
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return null; // Main domain or invalid
};
```

### 9.2 Tenant Context

```typescript
// src/context/TenantContext.tsx
interface TenantContextType {
  tenantId: string | null;
  tenantData: Tenant | null;
  isLoading: boolean;
}

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const tenantId = getTenantFromSubdomain();
  // Load tenant data from Firestore
  // ...
};
```

---

## 🚀 Step 10: Deployment Script

### 10.1 Automated Deployment

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

PROJECT_ID="tms-production"
REGION="us-central1"
SERVICE_NAME="tms-app"

echo "🚀 Deploying TMS to Production..."

# Build
npm run build

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 20 \
  --timeout 300 \
  --set-env-vars="ENVIRONMENT=production"

echo "✅ Deployment complete!"
```

---

## 📊 Step 11: Monitoring & Logging

### 11.1 Enable Monitoring

```bash
# Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com

# Enable Cloud Logging
gcloud services enable logging.googleapis.com
```

### 11.2 Set Up Alerts

```bash
# Create alert policy for errors
# Use Cloud Console: https://console.cloud.google.com/monitoring/alerting
```

---

## 💰 Step 12: Cost Optimization

### 12.1 Estimated Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| Cloud Run | 1M requests | ~$0.40 |
| Firestore | 10GB storage, 1M reads | ~$0.18 + $0.06 |
| Cloud Storage | 100GB | ~$2.00 |
| Load Balancer | Always on | ~$18.00 |
| SSL Certificate | Managed | Free |
| **Total** | | **~$20-25/month** |

### 12.2 Cost Optimization Tips

- Use Cloud CDN for static assets
- Enable Firestore caching
- Use Cloud Run min-instances=0 for dev (costs less)
- Set up billing alerts

---

## 🔄 Step 13: Tenant Management

### 13.1 Create New Tenant

```bash
# Admin script to create tenant
./scripts/create-tenant.sh company2 "Company 2 Name"
```

### 13.2 Tenant Admin Panel

Create admin interface at `admin.mydomain.com` for:
- Creating new tenants
- Managing tenant settings
- Viewing tenant usage
- Billing management

---

## ✅ Production Checklist

- [ ] Google Cloud project created
- [ ] Billing enabled
- [ ] All APIs enabled
- [ ] Firestore database created
- [ ] Domain purchased and DNS configured
- [ ] SSL certificate provisioned
- [ ] Load balancer configured
- [ ] Application deployed to Cloud Run
- [ ] Multi-tenant code implemented
- [ ] Security rules configured
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Cost alerts configured

---

## 🆘 Troubleshooting

### SSL Certificate Not Provisioning
- Wait 10-60 minutes
- Check DNS records are correct
- Verify domain ownership

### Subdomain Not Routing
- Check DNS A record points to Load Balancer IP
- Verify URL map configuration
- Check Cloud Run service is running

### Tenant Data Not Isolated
- Verify Firestore security rules
- Check tenant detection logic
- Review authentication claims

---

## 📚 Additional Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Load Balancer Guide](https://cloud.google.com/load-balancing/docs)
- [Firestore Multi-tenant Patterns](https://cloud.google.com/firestore/docs/solutions/multi-tenancy)
- [Domain Mapping](https://cloud.google.com/run/docs/mapping-custom-domains)

---

**Need Help?** Check the troubleshooting section or Google Cloud support.

