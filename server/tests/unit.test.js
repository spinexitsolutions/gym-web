import { describe, it, expect } from 'vitest';
import { deepMerge } from '../src/services/settings.service.js';
import { defaultSettings } from '../src/services/settings.defaults.js';
import { siteSettingsSchema, siteSettingsPatchSchema } from '../src/validators/settings.validator.js';
import { registerSchema, resetSchema } from '../src/validators/auth.validator.js';
import { contactSchema } from '../src/validators/content.validator.js';
import { sanitizeInput } from '../src/middleware/sanitize.js';
import { parsePagination } from '../src/utils/pagination.js';

describe('settings', () => {
  it('default settings satisfy the full schema', () => {
    const r = siteSettingsSchema.safeParse(defaultSettings);
    expect(r.success, JSON.stringify(r.error?.issues?.slice(0, 3))).toBe(true);
  });

  it('deepMerge merges objects and replaces arrays', () => {
    const out = deepMerge({ a: { b: 1, c: 2 }, list: [1, 2] }, { a: { c: 3 }, list: [9] });
    expect(out).toEqual({ a: { b: 1, c: 3 }, list: [9] });
  });

  it('rejects javascript: URLs in CMS links', () => {
    const r = siteSettingsPatchSchema.safeParse({ hero: { primaryCta: { label: 'x', href: 'javascript:alert(1)' } } });
    expect(r.success).toBe(false);
  });

  it('rejects invalid colours', () => {
    expect(siteSettingsPatchSchema.safeParse({ theme: { accent: 'gold' } }).success).toBe(false);
    expect(siteSettingsPatchSchema.safeParse({ theme: { accent: '#C9A54C' } }).success).toBe(true);
  });
});

describe('auth validation', () => {
  const base = { name: 'Asha Rao', email: 'ASHA@Example.com ', password: 'Str0ngPass', acceptTerms: true };

  it('normalises email and accepts a strong password', () => {
    const r = registerSchema.parse(base);
    expect(r.email).toBe('asha@example.com');
  });

  it('rejects weak passwords and missing consent', () => {
    expect(registerSchema.safeParse({ ...base, password: 'password' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });

  it('reset tokens must be 64 hex chars', () => {
    expect(resetSchema.safeParse({ token: 'abc', password: 'Str0ngPass' }).success).toBe(false);
    expect(resetSchema.safeParse({ token: 'a'.repeat(64), password: 'Str0ngPass' }).success).toBe(true);
  });
});

describe('contact validation', () => {
  it('flags a filled honeypot', () => {
    const r = contactSchema.parse({ name: 'Bot', email: 'b@x.com', message: 'hello there friend', website: 'spam.com' });
    expect(r.website).toBe('BOT');
  });
});

describe('sanitizeInput', () => {
  it('removes Mongo operators and prototype keys', () => {
    const req = { body: { email: { $gt: '' }, nested: { 'a.b': 1, ok: 2 }, ['__proto__']: { x: 1 } }, query: {}, params: {} };
    sanitizeInput(req, {}, () => {});
    expect(req.body.email).toEqual({});
    expect(req.body.nested).toEqual({ ok: 2 });
  });
});

describe('pagination', () => {
  it('clamps limits and only allows whitelisted sort fields', () => {
    const p = parsePagination({ page: '2', limit: '1000', sort: '-password' }, { sortable: ['name'] });
    expect(p).toMatchObject({ page: 2, limit: 100, skip: 100, sort: '-createdAt' });
  });
});
