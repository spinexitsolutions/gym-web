import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
