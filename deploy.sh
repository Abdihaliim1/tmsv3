#!/bin/bash

# TMS Pro Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_ID="somtms"
SERVICE_NAME="tms-pro"
REGION="europe-west1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Starting deployment to ${ENVIRONMENT}..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: Not logged in to gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set project
echo "📦 Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Build the app
echo "🔨 Building application..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
gcloud builds submit --tag ${IMAGE_NAME}

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format="value(status.url)")

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📋 Next steps:"
echo "1. Configure domain mapping in Cloud Run console"
echo "2. Add DNS records for your domain"
echo "3. Wait for SSL certificate provisioning"
echo "4. Access via your domain and configure company settings"

