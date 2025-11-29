#!/bin/bash

# Complete Setup and Deployment Script
# This script will guide you through authentication and deploy everything

set -e

echo "🚀 TMS Multi-Tenant Deployment Setup"
echo "======================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo "📦 Google Cloud SDK not found. Installing..."
  echo ""
  echo "Please choose installation method:"
  echo "1. Install via Homebrew (recommended for macOS)"
  echo "2. Download and install manually"
  echo ""
  read -p "Enter choice (1 or 2): " INSTALL_CHOICE
  
  if [ "$INSTALL_CHOICE" = "1" ]; then
    if command -v brew &> /dev/null; then
      echo "Installing via Homebrew..."
      brew install --cask google-cloud-sdk
    else
      echo "❌ Homebrew not found. Please install Homebrew first:"
      echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      exit 1
    fi
  else
    echo ""
    echo "Please install Google Cloud SDK manually:"
    echo "1. Visit: https://cloud.google.com/sdk/docs/install"
    echo "2. Download and install for macOS"
    echo "3. Run this script again"
    exit 1
  fi
  
  # Initialize gcloud
  echo ""
  echo "Initializing Google Cloud SDK..."
  gcloud init
fi

echo ""
echo "✅ Google Cloud SDK is installed"
echo ""

# Check authentication
echo "🔐 Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "Not authenticated. Starting login process..."
  echo ""
  echo "A browser window will open for you to sign in to Google Cloud."
  echo "Please use your Google Cloud account credentials."
  echo ""
  read -p "Press Enter to continue with login..."
  
  gcloud auth login
  
  echo ""
  echo "Setting up application default credentials..."
  gcloud auth application-default login
else
  ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
  echo "✅ Already authenticated as: $ACTIVE_ACCOUNT"
fi

echo ""
echo "📋 Current Google Cloud Configuration:"
gcloud config list

echo ""
echo "Do you want to:"
echo "1. Use existing project"
echo "2. Create new project"
read -p "Enter choice (1 or 2): " PROJECT_CHOICE

if [ "$PROJECT_CHOICE" = "2" ]; then
  echo ""
  read -p "Enter new project ID (lowercase, no spaces): " NEW_PROJECT_ID
  read -p "Enter project name: " NEW_PROJECT_NAME
  
  echo "Creating project..."
  gcloud projects create "$NEW_PROJECT_ID" --name="$NEW_PROJECT_NAME"
  gcloud config set project "$NEW_PROJECT_ID"
  
  echo ""
  echo "⚠️  IMPORTANT: Enable billing for this project"
  echo "Visit: https://console.cloud.google.com/billing"
  echo ""
  read -p "Press Enter after billing is enabled..."
else
  echo ""
  echo "Available projects:"
  gcloud projects list --format="table(projectId,name)"
  echo ""
  read -p "Enter project ID to use: " PROJECT_ID
  gcloud config set project "$PROJECT_ID"
fi

PROJECT_ID=$(gcloud config get-value project)
echo ""
echo "✅ Using project: $PROJECT_ID"
echo ""

# Get domain
echo "🌐 Domain Configuration"
read -p "Enter your domain (e.g., mydomain.com): " DOMAIN
export DOMAIN

echo ""
echo "📝 Summary:"
echo "  Project ID: $PROJECT_ID"
echo "  Domain: $DOMAIN"
echo "  Account: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
echo ""
read -p "Continue with deployment? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Deployment cancelled."
  exit 0
fi

# Enable APIs
echo ""
echo "🔧 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage-component.googleapis.com \
  compute.googleapis.com \
  dns.googleapis.com \
  --quiet

# Deploy application
echo ""
echo "🚀 Deploying application..."
export GCP_PROJECT_ID="$PROJECT_ID"
./scripts/deploy-production.sh

# Set up load balancer
echo ""
echo "🌐 Setting up load balancer..."
./scripts/setup-load-balancer.sh

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Add DNS records (instructions shown above)"
echo "2. Wait for SSL certificate (10-60 minutes)"
echo "3. Create your first tenant:"
echo "   ./scripts/create-tenant.sh company1 'Company 1 Name'"
echo "4. Access at: https://company1.$DOMAIN"

