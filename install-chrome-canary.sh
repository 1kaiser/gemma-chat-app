#!/bin/bash

# Install Chrome Canary for WebGPU support
echo "🔧 Installing Chrome Canary for WebGPU support..."

# Add Google's signing key
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

# Add Chrome Canary repository
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# Update package list
sudo apt update

# Install Chrome Canary (unstable)
sudo apt install -y google-chrome-unstable

# Verify installation
if command -v google-chrome-unstable &> /dev/null; then
    echo "✅ Chrome Canary installed successfully!"
    echo "📍 Path: $(which google-chrome-unstable)"
    google-chrome-unstable --version
else
    echo "❌ Chrome Canary installation failed"
fi

echo ""
echo "🎯 To use with Playwright, update the executablePath to:"
echo "   executablePath: '$(which google-chrome-unstable)'"