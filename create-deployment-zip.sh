#!/bin/bash
# Create deployment ZIP package for Gemma 3 270M
# Usage: ./create-deployment-zip.sh

set -e

echo "📦 Creating Gemma 3 270M deployment package..."

# Create deployment directory
DEPLOY_DIR="gemma-chat-deployment"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy essential files (exclude node_modules and build artifacts)
echo "📋 Copying project files..."
cp -r src/ "$DEPLOY_DIR/"
# cp -r tests/ "$DEPLOY_DIR/" # Tests directory removed from repo
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp tsconfig.json "$DEPLOY_DIR/"
cp vite.config.ts "$DEPLOY_DIR/"
# cp playwright.config.ts "$DEPLOY_DIR/" # Playwright config not needed for deployment
cp index.html "$DEPLOY_DIR/"
cp server.js "$DEPLOY_DIR/"
cp start.js "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/"
cp CLAUDE.md "$DEPLOY_DIR/"
cp start-server.sh "$DEPLOY_DIR/"
cp stop-server.sh "$DEPLOY_DIR/"
cp .gitignore "$DEPLOY_DIR/"

# Create deployment scripts
echo "🔧 Creating deployment scripts..."

# One-liner installer script
cat > "$DEPLOY_DIR/install-and-run.sh" << 'EOF'
#!/bin/bash
# Gemma 3 270M - One-Line Installer
# Usage: ./install-and-run.sh

set -e

echo "🪩 Gemma 3 270M - Quick Start 🪩"
echo "=============================="

# Check dependencies
if ! command -v node &> /dev/null; then
    echo "❌ Node.js required. Install from: https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm required. Install Node.js from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node --version)"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check WebGPU support (optional)
echo "🧪 Checking WebGPU support..."
if command -v google-chrome-canary &> /dev/null || command -v google-chrome &> /dev/null; then
    echo "✅ Chrome detected - WebGPU should work"
else
    echo "⚠️  Chrome/Chrome Canary recommended for WebGPU"
    echo "   Download Chrome Canary: https://www.google.com/chrome/canary/"
fi

# Start the application
echo ""
echo "🌐 Starting Gemma 3 270M..."
echo "🎯 Server: http://localhost:3001"
echo "🧠 First model load: 30-120 seconds"
echo "⚡ Cached loads: 5-15 seconds"
echo ""
echo "🖥️  For best performance, use Chrome Canary with flags:"
echo "   --enable-unsafe-webgpu --enable-features=WebGPU"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start server
npm start
EOF

# Windows batch file
cat > "$DEPLOY_DIR/install-and-run.bat" << 'EOF'
@echo off
echo 🪩 Gemma 3 270M - Quick Start (Windows) 🪩
echo =========================================

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js required. Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Installation failed
    pause
    exit /b 1
)

REM Start application
echo.
echo 🌐 Starting Gemma 3 270M...
echo 🎯 Server: http://localhost:3001
echo 🧠 First model load: 30-120 seconds
echo ⚡ Cached loads: 5-15 seconds
echo.
echo Press Ctrl+C to stop
echo.

npm start
EOF

# Make scripts executable
chmod +x "$DEPLOY_DIR/install-and-run.sh"

# Create README for deployment
cat > "$DEPLOY_DIR/DEPLOYMENT-README.md" << 'EOF'
# 🪩 Gemma 3 270M - Deployment Package 🪩

## 🚀 One-Line Quick Start

### Linux/macOS:
```bash
./install-and-run.sh
```

### Windows:
```cmd
install-and-run.bat
```

## What This Does
1. Checks Node.js 18+ is installed
2. Runs `npm install` to get dependencies  
3. Starts the chat app at http://localhost:3001
4. Downloads Gemma 270M model on first use (270MB)

## Browser Requirements
- **Chrome Canary** (recommended) with WebGPU flags:
  ```
  --enable-unsafe-webgpu
  --enable-features=WebGPU
  --enable-webgpu-developer-features
  ```
- Or Chrome 113+ with WebGPU enabled

## Manual Installation
If scripts don't work:
```bash
npm install
npm start
```

## First Run
- Model download: 270MB (one-time)
- Model loading: 30-120 seconds first time
- Subsequent loads: 5-15 seconds (cached)
- Memory usage: 400-800MB during chat

## Features
- ✅ Complete privacy (local AI inference)
- ✅ WebGPU acceleration  
- ✅ Real-time token streaming
- ✅ Conversation memory
- ✅ No API keys required

## Troubleshooting
1. **Node.js not found**: Install from https://nodejs.org/
2. **WebGPU errors**: Use Chrome Canary with flags above
3. **Memory issues**: Close other browser tabs
4. **Slow loading**: First model download takes time

## Testing
```bash
npm test              # Run all tests
npm run test:headed   # Debug with Chrome Canary
```

For support: https://github.com/your-repo/gemma-chat-app/issues
EOF

echo "📁 Creating ZIP archive..."
zip -r gemma-chat-deployment.zip "$DEPLOY_DIR/"

echo "✅ Deployment package created!"
echo ""
echo "📦 Package: gemma-chat-deployment.zip"
echo "📋 Contents:"
echo "   - Source code (src/, tests/)"
echo "   - Configuration files"
echo "   - One-line install scripts"
echo "   - Documentation"
echo ""
echo "🚀 To deploy:"
echo "   1. Upload gemma-chat-deployment.zip anywhere"
echo "   2. Unzip the file"
echo "   3. Run: ./install-and-run.sh (Linux/macOS) or install-and-run.bat (Windows)"
echo ""
echo "🎯 The app will start at http://localhost:3001"

# Cleanup
rm -rf "$DEPLOY_DIR"

echo ""
echo "✅ Deployment package ready for distribution!"