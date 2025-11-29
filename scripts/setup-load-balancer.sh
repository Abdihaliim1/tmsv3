#!/bin/bash

# Complete Load Balancer Setup Script for Multi-Tenant TMS
# This sets up everything needed for subdomain routing

set -e

PROJECT_ID=${GCP_PROJECT_ID:-"tms-production"}
REGION=${GCP_REGION:-"us-central1"}
DOMAIN=${DOMAIN:-"mydomain.com"}
SERVICE_NAME="tms-app"

echo "🌐 Setting up Load Balancer for Multi-Tenant TMS"
echo "================================================"
echo "Project: $PROJECT_ID"
echo "Domain: $DOMAIN"
echo ""

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI is not installed"
  exit 1
fi

gcloud config set project $PROJECT_ID

# Step 1: Reserve Static IP
echo "📌 Step 1: Reserving static IP..."
LB_IP=$(gcloud compute addresses describe tms-lb-ip --global --format="value(address)" 2>/dev/null || \
  gcloud compute addresses create tms-lb-ip --global --format="value(address)")

echo "✅ Load Balancer IP: $LB_IP"
echo ""
echo "⚠️  IMPORTANT: Add this DNS record to your domain:"
echo "   Type: A"
echo "   Name: *"
echo "   Value: $LB_IP"
echo "   (This will route all subdomains to the load balancer)"
echo ""
read -p "Press Enter after you've added the DNS record..."

# Step 2: Create SSL Certificate
echo ""
echo "🔒 Step 2: Creating SSL certificate..."
echo "This will take 10-60 minutes to provision..."

gcloud compute ssl-certificates create tms-ssl-cert \
  --domains="*.$DOMAIN,$DOMAIN" \
  --global || {
  echo "⚠️  Certificate might already exist, checking status..."
  gcloud compute ssl-certificates describe tms-ssl-cert --global
}

echo ""
echo "⏳ Waiting for SSL certificate to provision..."
echo "You can check status with:"
echo "  gcloud compute ssl-certificates describe tms-ssl-cert --global"
echo ""

# Step 3: Create Network Endpoint Group
echo "🔗 Step 3: Creating Network Endpoint Group..."
gcloud compute network-endpoint-groups create tms-neg \
  --region=$REGION \
  --network-endpoint-type=serverless \
  --cloud-run-service=$SERVICE_NAME || {
  echo "⚠️  NEG might already exist, continuing..."
}

# Step 4: Create Backend Service
echo "⚙️  Step 4: Creating backend service..."
gcloud compute backend-services create tms-backend \
  --global \
  --protocol=HTTP \
  --port-name=http \
  --enable-cdn || {
  echo "⚠️  Backend service might already exist, adding backend..."
}

gcloud compute backend-services add-backend tms-backend \
  --global \
  --network-endpoint-group=tms-neg \
  --network-endpoint-group-region=$REGION || {
  echo "⚠️  Backend might already be added..."
}

# Step 5: Create URL Map
echo "🗺️  Step 5: Creating URL map..."
gcloud compute url-maps create tms-url-map \
  --default-service=tms-backend \
  --global || {
  echo "⚠️  URL map might already exist..."
}

# Step 6: Create HTTPS Proxy
echo "🔐 Step 6: Creating HTTPS proxy..."
gcloud compute target-https-proxies create tms-https-proxy \
  --url-map=tms-url-map \
  --ssl-certificates=tms-ssl-cert || {
  echo "⚠️  HTTPS proxy might already exist..."
}

# Step 7: Create Forwarding Rules
echo "➡️  Step 7: Creating forwarding rules..."

# HTTPS
gcloud compute forwarding-rules create tms-https-forwarding-rule \
  --global \
  --target-https-proxy=tms-https-proxy \
  --ports=443 \
  --address=$LB_IP || {
  echo "⚠️  HTTPS forwarding rule might already exist..."
}

# HTTP (redirects to HTTPS)
gcloud compute target-http-proxies create tms-http-proxy \
  --url-map=tms-url-map || {
  echo "⚠️  HTTP proxy might already exist..."
}

gcloud compute forwarding-rules create tms-http-forwarding-rule \
  --global \
  --target-http-proxy=tms-http-proxy \
  --ports=80 \
  --address=$LB_IP || {
  echo "⚠️  HTTP forwarding rule might already exist..."
}

echo ""
echo "✅ Load Balancer setup complete!"
echo ""
echo "📋 Summary:"
echo "  Load Balancer IP: $LB_IP"
echo "  Domain: $DOMAIN"
echo "  Wildcard SSL: *.$DOMAIN"
echo ""
echo "⏳ Next Steps:"
echo "1. Wait for SSL certificate to provision (10-60 minutes)"
echo "2. Verify DNS records are pointing to: $LB_IP"
echo "3. Check SSL status:"
echo "   gcloud compute ssl-certificates describe tms-ssl-cert --global"
echo "4. Create your first tenant:"
echo "   ./scripts/create-tenant.sh company1 'Company 1 Name'"
echo "5. Access at: https://company1.$DOMAIN"
echo ""
echo "🔍 Check Load Balancer status:"
echo "   gcloud compute forwarding-rules list --global"

