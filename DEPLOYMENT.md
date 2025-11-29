# Deployment Guide - TMS Pro

## 🚀 Multi-Tenant Deployment Guide

This guide covers deploying TMS Pro to GitHub and Google Cloud with domain configuration.

---

## 📋 Prerequisites

1. **GitHub Account** - Repository access
2. **Google Cloud Account** - Project with billing enabled
3. **Domain** - Your domain (e.g., `mydomain.com`)
4. **Google Cloud SDK** - Installed and authenticated

---

## 📦 Step 1: Deploy to GitHub

### 1.1 Commit and Push Changes

```bash
# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Remove ATS Freight branding, add multi-tenant company settings

- Removed all ATS Freight hardcoded branding
- Created CompanyContext for dynamic company settings
- Added Settings page for company configuration
- Updated PDF generation to use company settings
- Made app ready for multi-company scaling
- Added accessorial deductions (TONU, Layover, Detention) to settlements
- Fixed settlement deletion to allow recreation
- Integrated real-time notifications for expiring documents"

# Push to GitHub
git push origin main
```

### 1.2 Verify GitHub Repository

- Go to your GitHub repository
- Verify all files are pushed
- Check that `package.json` shows `"name": "tms-pro"`

---

## ☁️ Step 2: Deploy to Google Cloud Run

### 2.1 Build and Deploy

```bash
# Set your project
gcloud config set project somtms

# Build the application
npm run build

# Create Dockerfile if not exists
cat > Dockerfile << 'EOF'
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

# Create nginx config for SPA
cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Build and push Docker image
gcloud builds submit --tag gcr.io/somtms/tms-pro

# Deploy to Cloud Run
gcloud run deploy tms-pro \
  --image gcr.io/somtms/tms-pro \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1
```

### 2.2 Get Service URL

```bash
# Get the service URL
gcloud run services describe tms-pro --region europe-west1 --format="value(status.url)"
```

Save this URL - you'll need it for domain mapping.

---

## 🌐 Step 3: Configure Domain

### 3.1 Domain Mapping in Google Cloud

1. **Go to Cloud Run Console**
   - Navigate to: https://console.cloud.google.com/run
   - Select your service: `tms-pro`
   - Click "MANAGE CUSTOM DOMAINS"

2. **Add Domain Mapping**
   ```
   Domain: mydomain.com
   Service: tms-pro
   Region: europe-west1
   ```

3. **Add Subdomain Mappings** (for multi-tenant)
   ```
   company1.mydomain.com → tms-pro
   company2.mydomain.com → tms-pro
   company3.mydomain.com → tms-pro
   ```

### 3.2 DNS Configuration

Google Cloud will provide DNS records. Add them to your domain registrar:

**Example DNS Records:**
```
Type: A
Name: @
Value: [Google Cloud IP]

Type: CNAME
Name: company1
Value: ghs.googlehosted.com

Type: CNAME
Name: company2
Value: ghs.googlehosted.com

Type: CNAME
Name: *
Value: ghs.googlehosted.com (wildcard for all subdomains)
```

### 3.3 SSL Certificate

Google Cloud automatically provisions SSL certificates for your domains. Wait 5-15 minutes for propagation.

---

## 🔧 Step 4: Configure Multi-Tenant Routing

### 4.1 Update Tenant Detection

The app already has tenant detection via subdomain. Verify `src/utils/tenant.ts`:

```typescript
// Should extract tenant from subdomain
// company1.mydomain.com → tenantId: "company1"
```

### 4.2 Test Multi-Tenant Access

1. Access via main domain: `https://mydomain.com`
2. Access via subdomain: `https://company1.mydomain.com`
3. Each tenant should see their own data (isolated by tenantId)

---

## ⚙️ Step 5: Initial Company Setup

### 5.1 First-Time Configuration

1. Access the app via your subdomain
2. Navigate to **Settings** page
3. Fill in company information:
   - Company Name
   - Address
   - Phone, Email, Website
   - DOT Number
   - Logo URL (optional)

4. Click **Save Company Settings**

### 5.2 Verify Branding

- Check sidebar shows company name
- Generate a settlement PDF - should show company info
- Print an invoice - should show company info

---

## 🔄 Step 6: Continuous Deployment (Optional)

### 6.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Google Cloud Run

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: somtms
      
      - name: Build and Deploy
        run: |
          gcloud builds submit --tag gcr.io/somtms/tms-pro
          gcloud run deploy tms-pro \
            --image gcr.io/somtms/tms-pro \
            --platform managed \
            --region europe-west1 \
            --allow-unauthenticated
```

### 6.2 Set GitHub Secrets

In GitHub repository → Settings → Secrets:
- `GCP_SA_KEY`: Service account JSON key

---

## 📊 Step 7: Monitoring & Maintenance

### 7.1 Check Deployment Status

```bash
# Check service status
gcloud run services describe tms-pro --region europe-west1

# View logs
gcloud run services logs read tms-pro --region europe-west1 --limit 50
```

### 7.2 Update Deployment

```bash
# After making changes
npm run build
gcloud builds submit --tag gcr.io/somtms/tms-pro
gcloud run deploy tms-pro --image gcr.io/somtms/tms-pro --region europe-west1
```

---

## 🎯 Multi-Tenant Architecture

### How It Works

1. **Subdomain Routing**
   - `company1.mydomain.com` → Tenant ID: `company1`
   - `company2.mydomain.com` → Tenant ID: `company2`

2. **Data Isolation**
   - All data stored with tenant prefix: `tms_company1_*`
   - Each tenant has separate:
     - Company settings
     - Loads, drivers, trucks, trailers
     - Invoices, settlements, expenses
     - Reports

3. **Company Branding**
   - Each tenant configures their own company info
   - Settings page allows customization
   - PDFs and invoices use tenant-specific branding

---

## 🐛 Troubleshooting

### Issue: Domain not resolving
- Check DNS records are correct
- Wait 24-48 hours for DNS propagation
- Verify domain mapping in Cloud Run console

### Issue: SSL certificate not working
- Wait 15-30 minutes after domain mapping
- Check certificate status in Cloud Console
- Verify DNS records are correct

### Issue: Subdomain not working
- Ensure wildcard CNAME is set: `* → ghs.googlehosted.com`
- Check Cloud Run domain mappings include subdomain
- Verify tenant detection logic in code

### Issue: Company settings not saving
- Check browser console for errors
- Verify localStorage is enabled
- Check tenant ID is correctly detected

---

## 📝 Next Steps

1. ✅ Deploy to GitHub
2. ✅ Deploy to Google Cloud Run
3. ✅ Configure domain and subdomains
4. ✅ Set up company settings for each tenant
5. ✅ Test multi-tenant isolation
6. ✅ Set up monitoring and alerts
7. ✅ Configure backup strategy

---

## 🔐 Security Considerations

- Each tenant's data is isolated by tenantId
- Company settings are stored per tenant
- No cross-tenant data access
- SSL/HTTPS enforced by Google Cloud
- Consider adding authentication layer for production

---

## 📞 Support

For deployment issues:
1. Check Google Cloud Run logs
2. Verify DNS configuration
3. Test tenant detection
4. Review company settings

