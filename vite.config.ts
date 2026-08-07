import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gemma-chat-app/',
  server: {
    port: 3001,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  plugins: [
    {
      // Cache model files in the browser so repeated page loads don't re-fetch.
      name: 'model-cache-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes('/models/')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
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