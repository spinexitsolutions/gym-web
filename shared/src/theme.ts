import { z } from 'zod';
import { hexColor, safeHref } from './common';

/** Fonts the client knows how to load from Google Fonts. Keeping an allowlist avoids arbitrary stylesheet injection. */
export const FONT_OPTIONS = {
  heading: ['Space Grotesk', 'Syne', 'Unbounded', 'Oswald', 'Bebas Neue', 'Playfair Display', 'Archivo', 'Sora'],
  body: ['Inter', 'Manrope', 'DM Sans', 'Outfit', 'Work Sans', 'Sora', 'Archivo'],
} as const;

const headingFont = z.enum(FONT_OPTIONS.heading);
const bodyFont = z.enum(FONT_OPTIONS.body);

export const themeTokensSchema = z.object({
  mode: z.enum(['dark', 'light']).default('dark'),
  colors: z.object({
    primary: hexColor,
    secondary: hexColor,
    accent: hexColor,
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    muted: hexColor,
    border: hexColor,
    success: hexColor,
    warning: hexColor,
    danger: hexColor,
  }),
  fonts: z.object({ heading: headingFont, body: bodyFont }),
  /** Corner radius in px for cards / inputs. */
  radius: z.number().int().min(0).max(32),
  buttonShape: z.enum(['pill', 'rounded', 'square']),
  buttonStyle: z.enum(['solid', 'outline', 'gradient', 'glass']),
  cardStyle: z.enum(['glass', 'solid', 'outline', 'elevated']),
  shadow: z.enum(['none', 'soft', 'dramatic']),
  spacing: z.enum(['compact', 'comfortable', 'spacious']),
  gradient: z.object({ from: hexColor, to: hexColor, angle: z.number().int().min(0).max(360) }),
  effects: z.object({
    customCursor: z.boolean(),
    grain: z.boolean(),
    glow: z.boolean(),
  }),
  header: z.object({
    transparentOnTop: z.boolean(),
    showLogin: z.boolean(),
    ctaLabel: z.string().trim().max(24),
    ctaHref: safeHref,
  }),
  footer: z.object({
    tagline: z.string().trim().max(200),
    showNewsletter: z.boolean(),
  }),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

const base: ThemeTokens = {
  mode: 'dark',
  colors: {
    primary: '#c6ff3d',
    secondary: '#9aa3ad',
    accent: '#c6ff3d',
    background: '#08090b',
    surface: '#121417',
    text: '#f4f5f6',
    muted: '#8b929b',
    border: '#24282e',
    success: '#3ddc84',
    warning: '#ffb547',
    danger: '#ff5a5f',
  },
  fonts: { heading: 'Space Grotesk', body: 'Inter' },
  radius: 18,
  buttonShape: 'pill',
  buttonStyle: 'solid',
  cardStyle: 'glass',
  shadow: 'dramatic',
  spacing: 'comfortable',
  gradient: { from: '#c6ff3d', to: '#4af2c8', angle: 135 },
  effects: { customCursor: true, grain: true, glow: true },
  header: { transparentOnTop: true, showLogin: true, ctaLabel: 'Join Now', ctaHref: '/memberships' },
  footer: {
    tagline: 'Engineered for people who train with intent. Precision equipment, elite coaching, zero compromise.',
    showNewsletter: true,
  },
};

export const THEME_PRESETS: Record<string, { label: string; tokens: ThemeTokens }> = {
  'titanium-lime': { label: 'Titanium Lime', tokens: base },
  'gold-reserve': {
    label: 'Gold Reserve',
    tokens: {
      ...base,
      colors: { ...base.colors, primary: '#d4af6a', accent: '#f1d9a0', secondary: '#a39a8a', background: '#0a0908', surface: '#151311', border: '#2a2620', muted: '#968d80' },
      fonts: { heading: 'Playfair Display', body: 'Manrope' },
      gradient: { from: '#d4af6a', to: '#f6e7c1', angle: 120 },
      buttonShape: 'square',
      radius: 6,
      cardStyle: 'outline',
    },
  },
  'ember-orange': {
    label: 'Ember Orange',
    tokens: {
      ...base,
      colors: { ...base.colors, primary: '#ff6b1a', accent: '#ffb27a', background: '#0b0807', surface: '#161210', border: '#2b221d' },
      fonts: { heading: 'Unbounded', body: 'DM Sans' },
      gradient: { from: '#ff6b1a', to: '#ff2d55', angle: 135 },
    },
  },
  'arctic-silver': {
    label: 'Arctic Silver',
    tokens: {
      ...base,
      colors: { ...base.colors, primary: '#dfe6ee', accent: '#7cc4ff', secondary: '#9fb0c2', background: '#07090c', surface: '#11151a', border: '#232a33' },
      fonts: { heading: 'Sora', body: 'Inter' },
      gradient: { from: '#dfe6ee', to: '#7cc4ff', angle: 150 },
      buttonStyle: 'glass',
    },
  },
  daylight: {
    label: 'Daylight (light)',
    tokens: {
      ...base,
      mode: 'light',
      colors: {
        primary: '#111315',
        secondary: '#5b636c',
        accent: '#5a7d00',
        background: '#f5f4f0',
        surface: '#ffffff',
        text: '#111315',
        muted: '#5f6670',
        border: '#dedbd3',
        success: '#18794e',
        warning: '#a35200',
        danger: '#c4262e',
      },
      gradient: { from: '#111315', to: '#5a7d00', angle: 135 },
      cardStyle: 'elevated',
      shadow: 'soft',
      effects: { customCursor: false, grain: false, glow: false },
    },
  },
};

export const DEFAULT_THEME: ThemeTokens = base;
