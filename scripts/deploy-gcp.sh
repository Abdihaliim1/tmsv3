#!/bin/bash

# Google Cloud Deployment Script
# Usage: ./scripts/deploy-gcp.sh [cloud-run|app-engine|storage]

set -e

DEPLOYMENT_TYPE=${1:-cloud-run}
PROJECT_ID=${GCP_PROJECT_ID:-""}
REGION=${GCP_REGION:-us-central1}

echo "🚀 TMS Google Cloud Deployment"
echo "=============================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if project ID is set
if [ -z "$PROJECT_ID" ]; then
    echo "📝 Enter your Google Cloud Project ID:"
    read PROJECT_ID
    export GCP_PROJECT_ID=$PROJECT_ID
fi

echo "📦 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "🔨 Building application..."
npm run build

case $DEPLOYMENT_TYPE in
  cloud-run)
    echo ""
    echo "🐳 Deploying to Cloud Run..."
    
    # Enable required APIs
    echo "Enabling Cloud Run API..."
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet
    
    # Deploy
    gcloud run deploy tms-app \
      --source . \
      --platform managed \
      --region $REGION \
      --allow-unauthenticated \
      --port 8080 \
      --memory 512Mi \
      --timeout 300 \
      --max-instances 10
    
    echo ""
    echo "✅ Deployment complete!"
    echo "Get your URL with:"
    echo "  gcloud run services describe tms-app --region $REGION --format 'value(status.url)'"
    ;;
    
  app-engine)
    echo ""
    echo "☁️ Deploying to App Engine..."
    
    # Enable App Engine API
    echo "Enabling App Engine API..."
    gcloud services enable appengine.googleapis.com --quiet
    
    # Initialize App Engine if needed
    if [ ! -f "app.yaml" ]; then
      echo "❌ Error: app.yaml not found"
      exit 1
    fi
    
    # Deploy
    gcloud app deploy app.yaml --quiet
    
    echo ""
    echo "✅ Deployment complete!"
    echo "Your app is available at:"
    gcloud app browse
    ;;
    
  storage)
    echo ""
    echo "📦 Deploying to Cloud Storage..."
    
    # Create bucket
    BUCKET_NAME="tms-app-$(date +%s)"
    echo "Creating bucket: $BUCKET_NAME"
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME || true
    
    # Make public
    echo "Making bucket publicly readable..."
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
    
    # Upload files
    echo "Uploading files..."
    gsutil -m cp -r dist/* gs://$BUCKET_NAME/
    
    # Set website configuration
    echo "Configuring static website..."
    gsutil web set -m index.html -e index.html gs://$BUCKET_NAME
    
    echo ""
    echo "✅ Deployment complete!"
    echo "Your app is available at:"
    echo "  http://storage.googleapis.com/$BUCKET_NAME/index.html"
    ;;
    
  *)
    echo "❌ Unknown deployment type: $DEPLOYMENT_TYPE"
    echo "Usage: $0 [cloud-run|app-engine|storage]"
    exit 1
    ;;
esac

echo ""
echo "🎉 Done!"

