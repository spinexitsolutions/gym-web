import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_PRESETS } from '@apex/shared';
import { applyTheme, themeToCssVars } from '@/lib/theme';

describe('theme engine', () => {
  it('maps tokens to CSS variables (RGB channels for Tailwind alpha support)', () => {
    const vars = themeToCssVars(DEFAULT_THEME);
    expect(vars['--c-primary']).toBe('198 255 61');
    expect(vars['--c-background']).toBe('8 9 11');
    expect(vars['--font-heading']).toBe("'Space Grotesk'");
    expect(vars['--btn-radius']).toBe('999px');
  });

  it('picks readable text colour on the primary colour', () => {
    expect(themeToCssVars(DEFAULT_THEME)['--c-on-primary']).toBe('8 9 11'); // light lime → dark text
    expect(themeToCssVars(THEME_PRESETS.daylight.tokens)['--c-on-primary']).toBe('255 255 255'); // near-black → white text
  });

  it('applies variables and style switches to the document', () => {
    const t = THEME_PRESETS['gold-reserve'].tokens;
    applyTheme(t);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--c-primary')).toBe('212 175 106');
    expect(root.dataset.card).toBe('outline');
    expect(root.dataset.mode).toBe('dark');
    expect(document.querySelector('link[data-apex-fonts]')?.getAttribute('href')).toContain('Playfair+Display');
  });
});
