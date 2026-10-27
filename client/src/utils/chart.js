import '../components/dashboard/chartDefaults.js';

// Recharts colours read from the live theme tokens so charts follow brand colour and dark/light mode.
export function chartColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => `rgb(${css.getPropertyValue(n).trim().split(' ').join(',')})`;
  return { accent: v('--accent'), soft: v('--accent-soft'), muted: v('--muted'), ink: v('--ink'), grid: `rgba(${css.getPropertyValue('--line').trim().split(' ').join(',')},0.08)`, success: v('--success'), danger: v('--danger'), surface: v('--elevated') };
}

export const rupeesShort = (paise) => {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(0)}k`;
  return `₹${Math.round(r)}`;
};

export const tooltipStyle = () => {
  const c = chartColors();
  return { contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, color: c.ink, fontSize: 12 }, labelStyle: { color: c.muted } };
};
