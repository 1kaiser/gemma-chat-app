#!/bin/bash

# Gemma Chat Server Startup Script
echo "🌟 Starting Gemma Chat Server..."
echo "================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install express if not present
if [ ! -d "node_modules/express" ]; then
    echo "📦 Installing express..."
    npm install express
fi

# Clear any existing processes on port 3001
echo "🔍 Checking port 3001..."
lsof -ti:3001 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "⚠️  Port 3001 is in use, stopping existing process..."
    kill -9 $(lsof -ti:3001) 2>/dev/null
    sleep 2
fi

# Start the server
echo "🚀 Launching server..."
echo "================================"
npm run start