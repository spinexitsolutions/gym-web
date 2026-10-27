import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/aurum_gym'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: bool.default(false),
  COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),
  // 'lax' when site and API share a domain (recommended). 'none' (requires COOKIE_SECURE=true) for cross-site.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('aurum-gym'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Aurum Fitness Club <no-reply@example.com>'),
  // Calendar day for attendance and reports is computed in this time zone.
  GYM_TIMEZONE: z.string().default('Asia/Kolkata'),
  INVOICE_GSTIN: z.string().optional(),
  // Without Razorpay keys, non-production servers use a clearly labelled sandbox gateway for testing.
  PAYMENT_SANDBOX: bool.default(true),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSISTANT_MODEL: z.string().default('claude-opus-5-5'),
  DISABLE_JOBS: bool.default(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print only variable names and messages, never values.
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const env = parsed.data;
if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
  console.warn('Warning: COOKIE_SECURE=false in production. Auth cookies will be sent over plain HTTP.');
}

export const clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export default env;
