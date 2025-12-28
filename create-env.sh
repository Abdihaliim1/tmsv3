#!/bin/bash
# Script to help create .env file

echo "=========================================="
echo "Firebase .env File Setup Helper"
echo "=========================================="
echo ""
echo "This script will help you create a .env file with Firebase configuration."
echo ""
echo "You need to get these values from Firebase Console:"
echo "1. Go to https://console.firebase.google.com/"
echo "2. Select your project (or create new one)"
echo "3. Click gear icon > Project Settings"
echo "4. Scroll to 'Your apps' > Click Web icon"
echo "5. Copy the firebaseConfig values"
echo ""
read -p "Press Enter when you have the Firebase config values ready..."

echo ""
echo "Enter your Firebase configuration values:"
echo ""

read -p "VITE_FIREBASE_API_KEY: " API_KEY
read -p "VITE_FIREBASE_AUTH_DOMAIN: " AUTH_DOMAIN
read -p "VITE_FIREBASE_PROJECT_ID: " PROJECT_ID
read -p "VITE_FIREBASE_STORAGE_BUCKET: " STORAGE_BUCKET
read -p "VITE_FIREBASE_MESSAGING_SENDER_ID: " SENDER_ID
read -p "VITE_FIREBASE_APP_ID: " APP_ID

cat > .env << ENVFILE
# Firebase Configuration
# Generated on $(date)

VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$SENDER_ID
VITE_FIREBASE_APP_ID=$APP_ID

# Optional: App Check (reCAPTCHA v3)
# VITE_RECAPTCHA_V3_SITE_KEY=your_recaptcha_site_key
ENVFILE

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Restart your dev server for changes to take effect:"
echo "   1. Stop the server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo ""
