import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSettings } from '../hooks/useSettings.js';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'aurum-theme';
const RADII = { none: '0px', sm: '0.375rem', md: '0.75rem', lg: '1.25rem' };
const FONT_QUERY = {
  'Playfair Display': 'Playfair+Display:wght@500;600;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@500;600;700',
  'Bebas Neue': 'Bebas+Neue',
  Oswald: 'Oswald:wght@400;500;600',
  Inter: 'Inter:wght@400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700',
  Outfit: 'Outfit:wght@400;500;600;700',
};

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const readStored = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};

export function ThemeProvider({ children }) {
  const { data: settings } = useSettings();
  const theme = settings?.theme;
  const [mode, setModeState] = useState(() => readStored() || 'dark');

  // First visit: follow the admin default until the visitor picks a mode.
  useEffect(() => {
    if (theme && !readStored()) setModeState(theme.defaultMode);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const effective = theme && !theme.allowToggle ? theme.defaultMode : mode;
    root.classList.toggle('light', effective === 'light');
    root.classList.toggle('dark', effective !== 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'light' ? '#F8F6F1' : theme?.background || '#0B0B0C');
  }, [mode, theme]);

  // Admin-managed brand tokens. Light mode keeps its own neutrals for readable contrast.
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement.style;
    const set = (name, hex) => { const rgb = hexToRgb(hex); if (rgb) root.setProperty(name, rgb); };
    if (mode !== 'light') {
      set('--accent', theme.accent);
      set('--bg', theme.background);
      set('--surface', theme.surface);
    } else {
      ['--accent', '--bg', '--surface'].forEach((p) => root.removeProperty(p));
    }
    set('--accent-soft', theme.accentSoft);
    root.setProperty('--radius', RADII[theme.radius] || RADII.md);
    root.setProperty('--font-heading', `'${theme.headingFont}'`);
    root.setProperty('--font-body', `'${theme.bodyFont}'`);

    const families = [...new Set([theme.headingFont, theme.bodyFont])].map((f) => FONT_QUERY[f]).filter(Boolean);
    const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
    let link = document.getElementById('brand-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'brand-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [theme, mode]);

  const setMode = useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* private mode */ }
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggle: () => setMode(mode === 'light' ? 'dark' : 'light'), canToggle: theme?.allowToggle ?? true }),
    [mode, setMode, theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
