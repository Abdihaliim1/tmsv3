#!/bin/bash

# Quick script to set up atsfreight.asal.llc domain

echo "🌐 Setting up domain: atsfreight.asal.llc"
echo ""

# Check if gcloud is configured
if ! gcloud config get-value project &> /dev/null; then
    echo "❌ Error: gcloud not configured"
    echo "Run: gcloud config set project somtms"
    exit 1
fi

echo "📋 Step 1: Creating domain mapping..."
gcloud run domain-mappings create \
  --service tms-pro \
  --domain atsfreight.asal.llc \
  --region europe-west1

echo ""
echo "📋 Step 2: Getting DNS records..."
echo ""
gcloud run domain-mappings describe atsfreight.asal.llc \
  --region europe-west1 \
  --format="value(status.resourceRecords)"

echo ""
echo "✅ Domain mapping created!"
echo ""
echo "📝 Next steps:"
echo "1. Copy the DNS records above"
echo "2. Add them to your domain registrar (asal.llc)"
echo "3. Wait 15-60 minutes for DNS propagation"
echo "4. SSL certificate will be provisioned automatically"
echo ""
echo "🔍 Check status:"
echo "   gcloud run domain-mappings describe atsfreight.asal.llc --region europe-west1"
