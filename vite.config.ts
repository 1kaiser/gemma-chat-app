import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: '/gemma-chat-app/',
  server: {
    port: 3001,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Return 404 for missing .onnx/.onnx_data files so Transformers.js
    // falls back to HuggingFace remote instead of getting SPA HTML.
    middlewareMode: false,
  },
  plugins: [
    {
      name: 'onnx-not-found',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (/\.(onnx|onnx_data)(\?.*)?$/.test(req.url ?? '')) {
            const url = req.url!.split('?')[0].replace('/gemma-chat-app', '');
            const filePath = path.join(process.cwd(), 'public', url);
            if (!fs.existsSync(filePath)) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }
          }
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
});