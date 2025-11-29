# 🚀 Google Cloud Deployment Guide

This guide covers multiple deployment options for the TMS application on Google Cloud Platform.

## 📋 Prerequisites

1. **Google Cloud Account**
   - Sign up at [cloud.google.com](https://cloud.google.com)
   - Enable billing (free tier available)

2. **Google Cloud SDK (gcloud CLI)**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

3. **Initialize gcloud**
   ```bash
   gcloud init
   gcloud auth login
   ```

---

## 🎯 Option 1: Cloud Storage + Cloud CDN (Recommended for Static Sites)

**Best for**: Static React apps, fastest setup, low cost

### Step 1: Build the Application

```bash
npm run build
```

This creates a `dist/` folder with production-ready files.

### Step 2: Create a Google Cloud Storage Bucket

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create bucket (must be globally unique)
export BUCKET_NAME="tms-app-$(date +%s)"
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://$BUCKET_NAME

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
```

### Step 3: Upload Build Files

```bash
# Upload all files from dist/ folder
gsutil -m cp -r dist/* gs://$BUCKET_NAME/

# Set index.html as default
gsutil web set -m index.html -e 404.html gs://$BUCKET_NAME
```

### Step 4: Enable Static Website Hosting

```bash
# Set bucket as website
gsutil web set -m index.html -e index.html gs://$BUCKET_NAME

# Get the public URL
echo "Your app is available at: http://storage.googleapis.com/$BUCKET_NAME/index.html"
```

### Step 5: (Optional) Set Up Custom Domain

```bash
# Create Cloud Load Balancer with custom domain
# See: https://cloud.google.com/storage/docs/hosting-static-website
```

### Step 6: (Optional) Enable Cloud CDN

```bash
# Create backend bucket
gcloud compute backend-buckets create tms-backend \
  --gcs-bucket-name=$BUCKET_NAME

# Create URL map
gcloud compute url-maps create tms-url-map \
  --default-backend-bucket=tms-backend

# Create HTTP proxy
gcloud compute target-http-proxies create tms-http-proxy \
  --url-map=tms-url-map

# Create forwarding rule
gcloud compute forwarding-rules create tms-forwarding-rule \
  --global \
  --target-http-proxy=tms-http-proxy \
  --ports=80
```

---

## 🐳 Option 2: Cloud Run (Containerized)

**Best for**: Full control, containerization, auto-scaling

### Step 1: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: Create nginx.conf

Create `nginx.conf` in project root:

```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # SPA routing - all routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Step 3: Build and Deploy

```bash
# Set project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable Cloud Run API
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build and deploy
gcloud run deploy tms-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080

# Or build Docker image first
gcloud builds submit --tag gcr.io/$PROJECT_ID/tms-app
gcloud run deploy tms-app \
  --image gcr.io/$PROJECT_ID/tms-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Step 4: Get Your URL

```bash
gcloud run services describe tms-app --region us-central1 --format 'value(status.url)'
```

---

## ☁️ Option 3: App Engine (PaaS)

**Best for**: Simple deployment, managed infrastructure

### Step 1: Create app.yaml

Create `app.yaml` in project root:

```yaml
runtime: nodejs18

env: standard

handlers:
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
    secure: always

  - url: /(.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json))$
    static_files: dist/\1
    upload: dist/(.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json))$
    secure: always

skip_files:
  - ^(?!dist)
```

### Step 2: Build and Deploy

```bash
# Build the app
npm run build

# Deploy to App Engine
gcloud app deploy app.yaml --project=your-project-id

# Open in browser
gcloud app browse
```

---

## 🔧 Option 4: Compute Engine (VM)

**Best for**: Full control, custom configurations

### Step 1: Create VM Instance

```bash
# Create instance
gcloud compute instances create tms-vm \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB

# SSH into instance
gcloud compute ssh tms-vm --zone=us-central1-a
```

### Step 2: Install Dependencies on VM

```bash
# On the VM
sudo apt update
sudo apt install -y nginx nodejs npm

# Install Node.js 18 (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3: Deploy Application

```bash
# On your local machine, copy files
gcloud compute scp --recurse . tms-vm:~/tms-app --zone=us-central1-a

# SSH into VM
gcloud compute ssh tms-vm --zone=us-central1-a

# On VM
cd ~/tms-app
npm install
npm run build

# Copy to nginx
sudo cp -r dist/* /var/www/html/

# Configure nginx
sudo nano /etc/nginx/sites-available/default
```

### Step 4: Configure Nginx

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Restart nginx
sudo systemctl restart nginx
```

### Step 5: Open Firewall

```bash
# Allow HTTP traffic
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --source-ranges 0.0.0.0/0 \
  --target-tags http-server
```

---

## 🔐 Environment Variables & Configuration

### For Cloud Run / App Engine

Create `.env.production`:

```env
VITE_API_URL=https://your-api-url.com
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain
```

Update `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  }
})
```

### For Static Hosting

Set environment variables during build:

```bash
VITE_API_URL=https://api.example.com npm run build
```

---

## 📊 Cost Comparison

| Option | Cost (approx) | Best For |
|--------|---------------|----------|
| Cloud Storage | $0.02/GB storage + $0.12/GB egress | Static sites, low traffic |
| Cloud Run | $0.40/million requests + compute | Auto-scaling, containers |
| App Engine | $0.05/hour (F1 instance) | Simple deployments |
| Compute Engine | $10-50/month | Full control, custom needs |

---

## 🚀 Quick Start (Recommended: Cloud Run)

```bash
# 1. Install gcloud CLI
# 2. Login
gcloud auth login

# 3. Set project
gcloud config set project YOUR_PROJECT_ID

# 4. Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# 5. Build and deploy
gcloud run deploy tms-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi

# 6. Get URL
gcloud run services describe tms-app --region us-central1 --format 'value(status.url)'
```

---

## 🔄 Continuous Deployment

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Google Cloud

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v1'
      
      - name: 'Deploy to Cloud Run'
        run: |
          gcloud run deploy tms-app \
            --source . \
            --platform managed \
            --region us-central1 \
            --allow-unauthenticated
```

---

## 🛠️ Troubleshooting

### Build Fails
- Check Node.js version (requires 18+)
- Verify all dependencies installed
- Check for TypeScript errors: `npm run build`

### 404 Errors on Routes
- Ensure nginx/Cloud Run serves `index.html` for all routes
- Check SPA routing configuration

### CORS Issues
- Configure CORS in your backend
- Add proper headers in nginx/Cloud Run

### Environment Variables Not Working
- Build-time variables: Use `VITE_` prefix
- Runtime variables: Use Cloud Run environment variables

---

## 📚 Additional Resources

- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Storage Pricing](https://cloud.google.com/storage/pricing)
- [App Engine Documentation](https://cloud.google.com/appengine/docs)

---

## ✅ Post-Deployment Checklist

- [ ] Application loads correctly
- [ ] All routes work (SPA routing)
- [ ] Environment variables configured
- [ ] HTTPS enabled (Cloud Run/App Engine)
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Cost alerts set up

---

**Need Help?** Check the [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) file or Google Cloud support.

