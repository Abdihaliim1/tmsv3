#!/bin/bash
# Quick script to update .env with Firebase values

echo "=========================================="
echo "Update Firebase Configuration"
echo "=========================================="
echo ""
echo "Enter your Firebase config values:"
echo "(Get them from Firebase Console > Project Settings > Your apps > Web)"
echo ""

read -p "API Key: " API_KEY
read -p "Auth Domain: " AUTH_DOMAIN
read -p "Project ID: " PROJECT_ID
read -p "Storage Bucket: " STORAGE_BUCKET
read -p "Messaging Sender ID: " SENDER_ID
read -p "App ID: " APP_ID

# Update .env file
sed -i '' "s|VITE_FIREBASE_API_KEY=.*|VITE_FIREBASE_API_KEY=$API_KEY|" .env
sed -i '' "s|VITE_FIREBASE_AUTH_DOMAIN=.*|VITE_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN|" .env
sed -i '' "s|VITE_FIREBASE_PROJECT_ID=.*|VITE_FIREBASE_PROJECT_ID=$PROJECT_ID|" .env
sed -i '' "s|VITE_FIREBASE_STORAGE_BUCKET=.*|VITE_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET|" .env
sed -i '' "s|VITE_FIREBASE_MESSAGING_SENDER_ID=.*|VITE_FIREBASE_MESSAGING_SENDER_ID=$SENDER_ID|" .env
sed -i '' "s|VITE_FIREBASE_APP_ID=.*|VITE_FIREBASE_APP_ID=$APP_ID|" .env

echo ""
echo "✅ .env file updated!"
echo ""
echo "⚠️  IMPORTANT: Restart your dev server now:"
echo "   1. Stop server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo ""
