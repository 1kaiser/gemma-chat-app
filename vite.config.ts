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
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
});