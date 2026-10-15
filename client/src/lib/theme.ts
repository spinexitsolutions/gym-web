import { DEFAULT_THEME, FONT_OPTIONS, type ThemeTokens } from '@apex/shared';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** Relative luminance, used to pick readable text on the primary colour. */
const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `${ch(16)} ${ch(8)} ${ch(0)}`;
};

/** Builds the CSS variable map for a theme. Pure so it can be unit-tested and used for previews. */
export function themeToCssVars(t: ThemeTokens): Record<string, string> {
  const c = t.colors;
  const radius = t.radius;
  const btnRadius = t.buttonShape === 'pill' ? '999px' : t.buttonShape === 'rounded' ? `${Math.max(6, Math.round(radius * 0.6))}px` : '2px';
  const shadow =
    t.shadow === 'none' ? 'none' : t.shadow === 'soft' ? '0 8px 30px -12px rgb(0 0 0 / 0.25)' : '0 30px 80px -30px rgb(0 0 0 / 0.75), 0 0 0 1px rgb(255 255 255 / 0.03)';
  const sectionY = t.spacing === 'compact' ? 'clamp(3.5rem, 7vw, 5.5rem)' : t.spacing === 'spacious' ? 'clamp(6rem, 13vw, 11rem)' : 'clamp(4.5rem, 10vw, 8.5rem)';
  return {
    '--c-primary': hexToRgb(c.primary),
    '--c-secondary': hexToRgb(c.secondary),
    '--c-accent': hexToRgb(c.accent),
    '--c-background': hexToRgb(c.background),
    '--c-surface': hexToRgb(c.surface),
    '--c-surface-2': mix(c.surface, c.text, t.mode === 'dark' ? 0.06 : 0.04),
    '--c-text': hexToRgb(c.text),
    '--c-muted': hexToRgb(c.muted),
    '--c-border': hexToRgb(c.border),
    '--c-success': hexToRgb(c.success),
    '--c-warning': hexToRgb(c.warning),
    '--c-danger': hexToRgb(c.danger),
    '--c-on-primary': luminance(c.primary) > 0.45 ? '8 9 11' : '255 255 255',
    '--c-grad-from': hexToRgb(t.gradient.from),
    '--c-grad-to': hexToRgb(t.gradient.to),
    '--grad-angle': `${t.gradient.angle}deg`,
    '--font-heading': `'${t.fonts.heading}'`,
    '--font-body': `'${t.fonts.body}'`,
    '--radius': `${radius}px`,
    '--btn-radius': btnRadius,
    '--shadow': shadow,
    '--section-y': sectionY,
  };
}

const loadedFonts = new Set<string>();
export function loadFonts(t: ThemeTokens) {
  const families = [t.fonts.heading, t.fonts.body].filter((f) => (FONT_OPTIONS.heading as readonly string[]).includes(f) || (FONT_OPTIONS.body as readonly string[]).includes(f));
  const key = families.join('|');
  if (loadedFonts.has(key) || typeof document === 'undefined') return;
  loadedFonts.add(key);
  const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.apexFonts = key;
  document.head.appendChild(link);
}

/** Applies the theme to an element (default :root). */
export function applyTheme(t: ThemeTokens = DEFAULT_THEME, el: HTMLElement = document.documentElement) {
  const vars = themeToCssVars(t);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.dataset.mode = t.mode;
  el.dataset.card = t.cardStyle;
  el.dataset.btn = t.buttonStyle;
  el.dataset.grain = String(t.effects.grain);
  el.dataset.glow = String(t.effects.glow);
  el.style.colorScheme = t.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.colors.background);
  loadFonts(t);
}
