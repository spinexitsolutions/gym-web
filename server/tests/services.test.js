import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

describe('pricing', () => {
  let couponDiscount;
  beforeAll(async () => ({ couponDiscount } = await import('../src/services/pricing.service.js')));

  it('applies percent discounts with a cap', () => {
    expect(couponDiscount({ discountType: 'percent', value: 10 }, 249900)).toBe(24990);
    expect(couponDiscount({ discountType: 'percent', value: 10, maxDiscountPaise: 20000 }, 249900)).toBe(20000);
  });
  it('never discounts more than the base price', () => {
    expect(couponDiscount({ discountType: 'fixed', value: 500000 }, 249900)).toBe(249900);
    expect(couponDiscount({ discountType: 'percent', value: 100 }, 249900)).toBe(249900);
    expect(couponDiscount(null, 249900)).toBe(0);
  });
});

describe('dates', () => {
  let d;
  beforeAll(async () => { d = await import('../src/utils/dates.js'); });

  it('converts gym-local time (Asia/Kolkata) to UTC', () => {
    expect(d.gymLocalToUtc('2026-03-10', '06:00', 'Asia/Kolkata').toISOString()).toBe('2026-03-10T00:30:00.000Z');
    expect(d.gymDay(new Date('2026-03-09T19:00:00Z'), 'Asia/Kolkata')).toBe('2026-03-10');
  });
  it('handles DST zones', () => {
    // New York is UTC-4 in July and UTC-5 in January.
    expect(d.gymLocalToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(d.gymLocalToUtc('2026-01-15', '09:00', 'America/New_York').toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });
  it('adds months without overflowing short months', () => {
    expect(d.addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(d.addMonths(new Date('2026-03-15T10:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2027-03-15');
  });
  it('day of week and minutes helpers', () => {
    expect(d.dayOfWeek('2026-10-25')).toBe(0); // Sunday
    expect(d.hhmmOf(d.minutesOf('07:45') + 60)).toBe('08:45');
  });
});

describe('csv', () => {
  it('escapes quotes/commas and neutralises spreadsheet formulas', async () => {
    const { toCsv } = await import('../src/utils/csv.js');
    const out = toCsv([{ a: '=HYPERLINK("x")', b: 'Rao, Asha' }], [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]);
    expect(out).toBe('A,B\r\n"\'=HYPERLINK(""x"")","Rao, Asha"');
  });
});

describe('razorpay signatures', () => {
  it('verifies checkout and webhook signatures with the configured secrets', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'secret_key';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'hook_secret';
    const { vi } = await import('vitest');
    vi.resetModules();
    const g = await import('../src/services/gateway.service.js');
    const sig = crypto.createHmac('sha256', 'secret_key').update('order_1|pay_1').digest('hex');
    expect(g.verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig })).toBe(true);
    expect(g.verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: sig })).toBe(false);
    const body = '{"event":"payment.captured"}';
    expect(g.verifyWebhookSignature(body, crypto.createHmac('sha256', 'hook_secret').update(body).digest('hex'))).toBe(true);
    expect(g.verifyWebhookSignature(`${body} `, crypto.createHmac('sha256', 'hook_secret').update(body).digest('hex'))).toBe(false);
    expect(g.activeProvider()).toBe('razorpay');
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; delete process.env.RAZORPAY_WEBHOOK_SECRET;
    vi.resetModules();
  });

  it('never enables the sandbox in production', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_SANDBOX = 'true';
    const g = await import('../src/services/gateway.service.js');
    expect(g.sandboxEnabled()).toBe(false);
    expect(g.activeProvider()).toBeNull();
    process.env.NODE_ENV = 'test';
    vi.resetModules();
  });
});

describe('QR tokens', () => {
  it('are audience-bound so a session token cannot be used as a check-in code', () => {
    const secret = process.env.JWT_ACCESS_SECRET;
    const session = jwt.sign({ sub: 'u1' }, secret);
    expect(() => jwt.verify(session, secret, { audience: 'gym-checkin' })).toThrow();
    const qr = jwt.sign({ sub: 'u1', jti: 'a' }, secret, { audience: 'gym-checkin', expiresIn: 60 });
    expect(jwt.verify(qr, secret, { audience: 'gym-checkin' }).sub).toBe('u1');
  });
});
