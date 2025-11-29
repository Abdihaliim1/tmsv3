#!/bin/bash

# Create New Tenant Script
# Usage: ./scripts/create-tenant.sh <subdomain> <company-name>

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <subdomain> <company-name>"
  echo "Example: $0 company1 'Company 1 Name'"
  exit 1
fi

SUBDOMAIN=$1
COMPANY_NAME=$2
PROJECT_ID=${GCP_PROJECT_ID:-"tms-production"}

# Validate subdomain
if ! [[ $SUBDOMAIN =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "❌ Invalid subdomain format. Use lowercase alphanumeric and hyphens only."
  exit 1
fi

if [ ${#SUBDOMAIN} -lt 3 ] || [ ${#SUBDOMAIN} -gt 63 ]; then
  echo "❌ Subdomain must be 3-63 characters long."
  exit 1
fi

echo "🏢 Creating tenant: $SUBDOMAIN"
echo "Company: $COMPANY_NAME"
echo ""

# Check if Firestore is available
if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI is not installed"
  exit 1
fi

gcloud config set project $PROJECT_ID

# Create tenant document in Firestore
echo "📝 Creating tenant document in Firestore..."
gcloud firestore documents create \
  tenants/$SUBDOMAIN \
  --data='{
    "name": "'"$COMPANY_NAME"'",
    "subdomain": "'"$SUBDOMAIN"'",
    "domain": "'"$SUBDOMAIN"'.mydomain.com",
    "status": "active",
    "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }' || {
    echo "⚠️  Tenant might already exist. Updating instead..."
    gcloud firestore documents update \
      tenants/$SUBDOMAIN \
      --data='{
        "name": "'"$COMPANY_NAME"'",
        "status": "active",
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
      }'
  }

# Create Cloud Storage bucket for tenant
BUCKET_NAME="tms-${SUBDOMAIN}-files"
echo "📦 Creating storage bucket: $BUCKET_NAME"
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://$BUCKET_NAME || {
  echo "⚠️  Bucket might already exist. Skipping..."
}

# Set bucket permissions
echo "🔐 Setting bucket permissions..."
gsutil iam ch serviceAccount:$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")@cloudbuild.gserviceaccount.com:objectAdmin gs://$BUCKET_NAME

echo ""
echo "✅ Tenant created successfully!"
echo ""
echo "Tenant Details:"
echo "  Subdomain: $SUBDOMAIN"
echo "  Domain: ${SUBDOMAIN}.mydomain.com"
echo "  Company: $COMPANY_NAME"
echo "  Storage: gs://$BUCKET_NAME"
echo ""
echo "Next Steps:"
echo "1. Add DNS A record: $SUBDOMAIN.mydomain.com -> [Load Balancer IP]"
echo "2. SSL certificate will auto-provision for *.mydomain.com"
echo "3. Access at: https://${SUBDOMAIN}.mydomain.com"

