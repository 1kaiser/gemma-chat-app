#!/bin/bash

# Gemma Chat Server Shutdown Script
echo "🔌 Stopping Gemma Chat Server..."
echo "================================"

# Find and kill processes on port 3001
lsof -ti:3001 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "🛑 Stopping server on port 3001..."
    kill -9 $(lsof -ti:3001) 2>/dev/null
    echo "✅ Server stopped successfully"
else
    echo "ℹ️  No server running on port 3001"
fi

# Also kill any vite processes
pkill -f "vite" 2>/dev/null
pkill -f "node server.js" 2>/dev/null

echo "================================"
echo "👋 Shutdown complete"