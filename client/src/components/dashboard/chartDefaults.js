import { Area, Bar, Line, Pie } from 'recharts';

// Respect prefers-reduced-motion for every Recharts series without touching each chart.
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
if (reduced) [Area, Bar, Line, Pie].forEach((C) => { C.defaultProps = { ...C.defaultProps, isAnimationActive: false }; });
