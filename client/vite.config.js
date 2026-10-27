import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin proxy in development so auth cookies are first-party.
    proxy: Object.fromEntries(['/api', '/sitemap.xml', '/robots.txt'].map((p) => [p, { target: process.env.VITE_API_PROXY || 'http://localhost:5000', changeOrigin: true }])),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900, // the lazily loaded three.js chunk is ~820 kB and only fetched on desktop
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    css: false,
  },
});
