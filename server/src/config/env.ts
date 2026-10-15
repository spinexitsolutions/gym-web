import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/apex_athletics'),
  /** Comma-separated list of allowed browser origins. */
  CLIENT_URL: z.string().default('http://localhost:5173'),
  /** Public base URL of the site, used in emails, sitemap and canonical URLs. */
  PUBLIC_SITE_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SERVE_CLIENT: bool(false),
  CLIENT_DIST_DIR: z.string().default('../client/dist'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: bool(false),
  COOKIE_DOMAIN: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: bool(false),

  PAYMENT_PROVIDER: z.enum(['razorpay', 'sandbox', 'disabled']).default('disabled'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /** Minutes before an unpaid order is marked expired. */
  PAYMENT_ORDER_TTL_MIN: z.coerce.number().int().min(5).default(60),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Apex Athletics <no-reply@example.com>'),

  WHATSAPP_PROVIDER: z.enum(['none', 'meta', 'twilio']).default('none'),
  WHATSAPP_META_TOKEN: z.string().optional(),
  WHATSAPP_META_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_META_TEMPLATE_LANG: z.string().default('en'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('apex-athletics'),
  MAX_IMAGE_MB: z.coerce.number().min(1).max(25).default(8),
  MAX_MODEL_MB: z.coerce.number().min(1).max(50).default(15),

  JOBS_ENABLED: bool(true),
  /** Login/register/reset attempts per IP per 15 minutes. */
  AUTH_RATE_LIMIT: z.coerce.number().int().min(5).max(10000).default(30),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}\nSee server/.env.example`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.PAYMENT_PROVIDER === 'sandbox') throw new Error('PAYMENT_PROVIDER=sandbox is not allowed in production');
    if (!env.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
  }
  if (env.PAYMENT_PROVIDER === 'razorpay' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)) {
    throw new Error('PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  }
  if (env.STORAGE_DRIVER === 'cloudinary' && !(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) {
    throw new Error('STORAGE_DRIVER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET');
  }
  return env;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const allowedOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
