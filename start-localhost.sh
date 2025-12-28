#!/bin/bash

# TMS Pro - Localhost Development Server Startup Script

echo "🚀 Starting TMS Pro Development Server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if port 2811 is in use
if lsof -Pi :2811 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 2811 is already in use!"
    echo "   Trying to kill the process..."
    lsof -ti:2811 | xargs kill -9 2>/dev/null
    sleep 2
    echo "   Port cleared!"
    echo ""
fi

# Start the development server
echo "✅ Starting development server on http://localhost:2811"
echo "   Press Ctrl+C to stop the server"
echo ""

npm run dev

