import type { Config } from 'tailwindcss';

/** Colours are CSS variables (RGB channels) set at runtime from the published theme. */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-mode="dark"]'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', md: '2rem', xl: '2.5rem' }, screens: { '2xl': '1360px' } },
    extend: {
      colors: {
        primary: c('primary'),
        secondary: c('secondary'),
        accent: c('accent'),
        bg: c('background'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        fg: c('text'),
        muted: c('muted'),
        line: c('border'),
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
        'on-primary': c('on-primary'),
      },
      fontFamily: {
        display: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        theme: 'var(--radius)',
        'theme-sm': 'calc(var(--radius) * 0.6)',
        btn: 'var(--btn-radius)',
      },
      boxShadow: {
        theme: 'var(--shadow)',
        glow: '0 0 0 1px rgb(var(--c-primary) / 0.25), 0 10px 40px -10px rgb(var(--c-primary) / 0.45)',
      },
      spacing: { section: 'var(--section-y)' },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 7.5vw, 6.75rem)', { lineHeight: '0.95', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 5vw, 4.25rem)', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 3.2vw, 2.75rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(var(--grad-angle), rgb(var(--c-grad-from)), rgb(var(--c-grad-to)))',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.2,.7,.2,1) both',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
