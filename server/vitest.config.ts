import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/resetModels.ts', './tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Environment for src/config/env.ts — test-only values, never real secrets.
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-test-secret',
      PAYMENT_PROVIDER: 'sandbox',
      RAZORPAY_KEY_ID: 'rzp_test_dummy',
      RAZORPAY_KEY_SECRET: 'rzp_test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'rzp_test_webhook_secret',
      JOBS_ENABLED: 'false',
      UPLOAD_DIR: path.join(os.tmpdir(), 'apex-test-uploads'),
      PUBLIC_SITE_URL: 'http://localhost:5173',
    },
  },
});
