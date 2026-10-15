import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, SECTION_META, SECTION_TYPES, THEME_PRESETS, calculateBmi, createSection, estimateCalories, safeHref, sectionPropsSchemas, siteSettingsSchema, themeTokensSchema, validateSections } from '../src';

describe('section registry', () => {
  it('has metadata, defaults and a schema for every section type', () => {
    for (const type of SECTION_TYPES) {
      expect(SECTION_META[type], type).toBeDefined();
      expect(sectionPropsSchemas[type], type).toBeDefined();
      for (const f of SECTION_META[type].fields) {
        expect(Object.keys((sectionPropsSchemas[type] as unknown as { shape: object }).shape), `${type}.${f.key}`).toContain(f.key);
      }
    }
  });

  it('builds valid sections from defaults (except types needing required content)', () => {
    const sections = SECTION_TYPES.map((t) => createSection(t));
    const res = validateSections(sections);
    expect(res.ok).toBe(true);
  });

  it('reports precise issues for invalid sections and duplicate ids', () => {
    const a = createSection('hero');
    const res = validateSections([{ ...a, props: { headline: '' } }, a, a]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].issues[0].path).toBe('props.headline');
      expect(res.errors.some((e) => e.issues.some((i) => i.message === 'Duplicate section id'))).toBe(true);
    }
  });
});

describe('safety validators', () => {
  it.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,hi', '//evil.example', 'vbscript:x'])('rejects unsafe link %s', (href) => {
    expect(safeHref.safeParse(href).success).toBe(false);
  });
  it.each(['/memberships', '#trial', 'https://instagram.com/apex', 'mailto:hi@x.com', 'tel:+911234', ''])('accepts %s', (href) => {
    expect(safeHref.safeParse(href).success).toBe(true);
  });
});

describe('theme', () => {
  it('all presets are valid theme tokens', () => {
    for (const [id, p] of Object.entries(THEME_PRESETS)) expect(themeTokensSchema.safeParse(p.tokens).success, id).toBe(true);
    expect(themeTokensSchema.parse(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
  });
  it('rejects CSS injection in colours and unknown fonts', () => {
    expect(themeTokensSchema.safeParse({ ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: 'red;}body{display:none' } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...DEFAULT_THEME, fonts: { heading: 'Evil Font', body: 'Inter' } }).success).toBe(false);
  });
  it('site settings only allow Google Maps embed URLs', () => {
    const base = { brand: { name: 'X' }, announcement: {}, contact: {}, location: {}, business: {}, seo: {}, notifications: {}, privacy: {}, bookings: {}, loyalty: {} };
    expect(siteSettingsSchema.safeParse({ ...base, location: { mapEmbedUrl: 'https://evil.example/frame' } }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ ...base, location: { mapEmbedUrl: 'https://www.google.com/maps/embed?pb=abc' } }).success).toBe(true);
  });
});

describe('fitness helpers', () => {
  it('calculates BMI and calorie estimates', () => {
    expect(calculateBmi(80, 180)).toBe(24.7);
    expect(calculateBmi(0, 180)).toBeNull();
    const est = estimateCalories({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate' });
    expect(est).toEqual({ bmr: 1780, maintenance: 2759 });
    expect(estimateCalories({ weightKg: 80, heightCm: 180, age: 10, sex: 'male', activity: 'moderate' })).toBeNull();
  });
});
