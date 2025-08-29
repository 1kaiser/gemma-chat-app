#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🌟 Starting Gemma Chat App with WebGPU support...');
console.log('📦 Installing dependencies...');

// First install dependencies
const install = spawn('npm', ['install'], {
  cwd: __dirname,
  stdio: 'inherit'
});

install.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
  
  console.log('✅ Dependencies installed successfully');
  console.log('🚀 Starting development server...');
  console.log('🔥 WebGPU support enabled for Gemma 270M model');
  console.log('');
  console.log('📍 Server will be available at: http://localhost:3001');
  console.log('🤖 AI Model: Gemma 3 270M ONNX with WebGPU acceleration');
  console.log('⚡ Features: Real-time streaming, Web Workers, Complete Privacy');
  console.log('');
  console.log('💡 Make sure you are using Chrome Canary with WebGPU enabled!');
  console.log('   Chrome flags: --enable-unsafe-webgpu --enable-features=WebGPU');
  console.log('');
  
  // Start the development server
  const dev = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  dev.on('close', (code) => {
    console.log('👋 Gemma Chat App stopped');
    process.exit(code);
  });
});