#!/bin/bash
# Gemma Chat App - One-Click Deployment Script
# Run with: curl -fsSL https://raw.githubusercontent.com/your-repo/gemma-chat-app/main/deploy.sh | bash

set -e

echo "🚀 Gemma Chat App - One-Click Deployment"
echo "========================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION found. Requires Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "📦 Downloading Gemma Chat App..."
curl -fsSL https://github.com/your-repo/gemma-chat-app/archive/main.zip -o gemma-chat-app.zip

echo "📂 Extracting files..."
unzip -q gemma-chat-app.zip
cd gemma-chat-app-main

echo "📋 Installing dependencies..."
npm install

echo "🧪 Running quick health check..."
npm run test -- --grep "WebGPU detection" || echo "⚠️  WebGPU tests failed (may be expected on headless)"

echo "🌐 Starting Gemma Chat App..."
echo ""
echo "🎯 Server will start at: http://localhost:3001"
echo "🖥️  Use Chrome Canary for best WebGPU support"
echo "🧠 First model load: 30-120 seconds"
echo "⚡ Subsequent loads: 5-15 seconds"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start