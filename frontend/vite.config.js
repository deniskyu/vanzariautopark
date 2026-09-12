import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Panoul de admin. În dev, proxy către Worker-ul local (wrangler dev pe 8787),
// ca să nu ai probleme de CORS/cookie în timpul dezvoltării.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
