#!/bin/bash

# Production Deployment Script for Multi-Tenant TMS
# Usage: ./scripts/deploy-production.sh

set -e

PROJECT_ID=${GCP_PROJECT_ID:-"tms-production"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="tms-app"
MIN_INSTANCES=${MIN_INSTANCES:-1}
MAX_INSTANCES=${MAX_INSTANCES:-20}

echo "🚀 Deploying TMS to Production (Multi-Tenant)"
echo "=============================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI is not installed"
  exit 1
fi

# Set project
echo "📝 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  compute.googleapis.com \
  dns.googleapis.com \
  --quiet

# Build application
echo ""
echo "🔨 Building application..."
npm ci
npm run build

# Deploy to Cloud Run
echo ""
echo "🐳 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances $MIN_INSTANCES \
  --max-instances $MAX_INSTANCES \
  --timeout 300 \
  --set-env-vars="ENVIRONMENT=production,NODE_ENV=production" \
  --add-cloudsql-instances="" \
  --execution-environment=gen2

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next Steps:"
echo "1. Configure Load Balancer (see docs/MULTI_TENANT_SETUP.md)"
echo "2. Set up DNS records"
echo "3. Wait for SSL certificate provisioning"
echo "4. Create tenants using: ./scripts/create-tenant.sh"

