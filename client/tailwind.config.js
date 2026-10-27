/** Colours resolve to CSS variables that ThemeProvider sets from the admin-managed theme. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', md: '2rem' }, screens: { '2xl': '1320px' } },
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        elevated: v('elevated'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        gold: { DEFAULT: v('accent'), soft: v('accent-soft') },
        success: v('success'),
        danger: v('danger'),
      },
      fontFamily: {
        display: ['var(--font-heading)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { brand: 'var(--radius)' },
      letterSpacing: { eyebrow: '0.28em' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 20px 60px -20px rgb(var(--accent) / 0.35)',
        card: '0 30px 60px -30px rgb(0 0 0 / 0.6)',
      },
      backgroundImage: {
        'gold-metal': 'linear-gradient(135deg, rgb(var(--accent-soft)) 0%, rgb(var(--accent)) 45%, rgb(var(--accent) / 0.85) 100%)',
      },
    },
  },
  plugins: [],
};
