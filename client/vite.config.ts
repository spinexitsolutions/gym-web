/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/uploads': { target: API, changeOrigin: false },
      '/sitemap.xml': { target: API },
      '/robots.txt': { target: API },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Function form matches package paths only. The object form also pulled Vite's preload
        // helper into the r3f chunk, which made every page eagerly download three.js.
        manualChunks(id) {
          // Vite/Rollup virtual helpers (preload helper, CJS interop) go to a tiny shared chunk.
          if (id.startsWith('\0')) return 'runtime';
          if (!id.includes('/node_modules/')) return undefined;
          // Tiny utilities shared by app code and lazy libraries must not drag those libraries in.
          if (/\/node_modules\/(clsx|tailwind-merge|react|react-dom|react-is|scheduler|prop-types|use-sync-external-store)\//.test(id)) return 'runtime';
          if (/\/node_modules\/three\//.test(id)) return 'three';
          if (/\/node_modules\/(@react-three|three-stdlib|postprocessing|maath|troika-|camera-controls)/.test(id)) return 'r3f';
          if (/\/node_modules\/(recharts|d3-)/.test(id)) return 'charts';
          if (/\/node_modules\/gsap\//.test(id)) return 'gsap';
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
});
