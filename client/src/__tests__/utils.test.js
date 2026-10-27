import { describe, it, expect } from 'vitest';
import { bmi, dailyCalories, workoutCalories } from '../utils/fitness.js';
import { responsive } from '../utils/media.js';
import { safeNext, homeFor } from '../utils/redirect.js';
import { formatPaise, to12h, whatsappLink } from '../utils/format.js';
import { registerSchema } from '../forms/schemas.js';

describe('fitness tools', () => {
  it('computes BMI and category', () => {
    expect(bmi(70, 175)).toMatchObject({ value: 22.9, category: 'Healthy weight' });
    expect(bmi(95, 170).category).toBe('Obese');
    expect(bmi(0, 170)).toBeNull();
  });

  it('computes Mifflin-St Jeor calories', () => {
    const r = dailyCalories({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'moderate' });
    expect(r.bmr).toBe(1780); // 800 + 1125 - 150 + 5
    expect(r.maintain).toBe(Math.round(1780 * 1.55));
    expect(r.lose).toBe(r.maintain - 500);
  });

  it('estimates workout calories from MET', () => {
    expect(workoutCalories({ met: 8, weightKg: 70, minutes: 30 })).toBe(294);
    expect(workoutCalories({ met: 8, weightKg: 70, minutes: 0 })).toBeNull();
  });
});

describe('media', () => {
  it('builds Unsplash and Cloudinary srcsets', () => {
    const u = responsive('https://images.unsplash.com/photo-1?auto=format&fit=crop&q=80');
    expect(u.srcSet).toContain('w=480');
    expect(u.srcSet).toContain('2560w');
    const c = responsive('https://res.cloudinary.com/demo/image/upload/v1/gym/a.jpg', 1080);
    expect(c.src).toContain('/upload/f_auto,q_auto,c_limit,w_1080/');
    expect(responsive('/local.png')).toEqual({ src: '/local.png' });
  });
});

describe('redirects', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/account')).toBe('/account');
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(homeFor({ role: 'admin' })).toBe('/admin');
    expect(homeFor({ role: 'member' })).toBe('/dashboard');
    expect(homeFor({ role: 'trainer' })).toBe('/trainer');
  });
});

describe('format', () => {
  it('formats money, time and WhatsApp links', () => {
    expect(formatPaise(249900)).toBe('₹2,499');
    expect(to12h('05:00')).toBe('5:00 AM');
    expect(to12h('23:30')).toBe('11:30 PM');
    expect(whatsappLink('+91 90000-00000', 'Hi there')).toBe('https://wa.me/919000000000?text=Hi%20there');
  });
});

describe('register schema', () => {
  const ok = { name: 'Asha', email: 'a@b.com', password: 'Str0ngPass', confirmPassword: 'Str0ngPass', acceptTerms: true };
  it('requires matching strong passwords and consent', () => {
    expect(registerSchema.safeParse(ok).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, confirmPassword: 'x' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: 'weakpass', confirmPassword: 'weakpass' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptTerms: false }).success).toBe(false);
  });
});
