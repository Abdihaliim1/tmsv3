#!/bin/bash

# Authentication and Deployment Script
# Run this script to authenticate and deploy

set -e

export PATH="$HOME/google-cloud-sdk/google-cloud-sdk/bin:$PATH"

echo "🔐 Step 1: Authenticating with Google Cloud"
echo "============================================="
echo ""
echo "A browser window will open for you to sign in."
echo "Please sign in with: abdixaliim@gmail.com"
echo ""
read -p "Press Enter to open authentication..."

gcloud auth login abdixaliim@gmail.com

echo ""
echo "✅ Authentication complete!"
echo ""

echo "🔧 Step 2: Setting up project"
echo "=============================="
echo ""

# Check if project exists
if gcloud projects describe somtms &>/dev/null; then
  echo "✅ Project 'somtms' already exists"
else
  echo "Creating project 'somtms'..."
  gcloud projects create somtms --name="SOM TMS"
fi

gcloud config set project somtms

echo ""
echo "⚠️  IMPORTANT: Enable billing for project 'somtms'"
echo "Visit: https://console.cloud.google.com/billing?project=somtms"
echo ""
read -p "Press Enter AFTER you've enabled billing..."

echo ""
echo "🔧 Step 3: Enabling required APIs"
echo "==================================="
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  compute.googleapis.com \
  --quiet

echo ""
echo "✅ APIs enabled!"
echo ""

echo "🏗️  Step 4: Building application"
echo "=================================="
cd "$(dirname "$0")/.."
npm run build

echo ""
echo "🚀 Step 5: Deploying to Cloud Run"
echo "=================================="
echo "This will take 3-5 minutes..."
echo ""

gcloud run deploy tms-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars="ENVIRONMENT=production,NODE_ENV=production" \
  --project somtms

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe tms-app --region us-central1 --format 'value(status.url)' --project somtms)

echo "🎉 Your TMS is now live!"
echo ""
echo "📍 Test URL: $SERVICE_URL"
echo ""
echo "You can access your application at the URL above."
echo ""
echo "Later, when you have a domain, we can:"
echo "1. Set up custom domain mapping"
echo "2. Configure load balancer"
echo "3. Add SSL certificates"
echo "4. Set up subdomain routing (company1.yourdomain.com)"
echo ""

