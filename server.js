#!/usr/bin/env node

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import express from 'express';
import { networkInterfaces } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getNetworkIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

async function startServer() {
    // Create Vite server
    const vite = await createServer({
        root: __dirname,
        server: {
            port: 3001,
            middlewareMode: true,
        },
    });

    const app = express();
    
    // Use Vite middleware
    app.use(vite.middlewares);

    // Add shutdown endpoint
    app.post('/api/shutdown', (req, res) => {
        console.log('🔌 Shutdown request received...');
        res.json({ message: 'Server shutting down...' });
        
        setTimeout(() => {
            console.log('👋 Goodbye! Server is shutting down.');
            process.exit(0);
        }, 1000);
    });

    const networkIP = getNetworkIP();
    const server = app.listen(3001, '0.0.0.0', () => {
        console.log('\n🌟 Gemma Chat Server Started!');
        console.log('🌐 Local: http://localhost:3001');
        console.log(`🌐 Network: http://${networkIP}:3001`);
        console.log('🔌 Shutdown: Click the shutdown button in the UI');
        console.log('⌨️  Or press Ctrl+C to stop the server\n');
    });

    // Handle graceful shutdown on Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down gracefully...');
        server.close(() => {
            console.log('✅ Server closed successfully');
            process.exit(0);
        });
    });
}

startServer().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});