import { cn } from '../../utils/cn.js';

const TONES = {
  gold: 'border-gold/40 bg-gold/10 text-gold',
  neutral: 'border-line/15 bg-ink/5 text-muted',
  success: 'border-success/40 bg-success/10 text-success',
  danger: 'border-danger/40 bg-danger/10 text-danger',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider', TONES[tone], className)}>
      {children}
    </span>
  );
}

// Shown on seeded sample content so it is never mistaken for a real member story.
export const DemoBadge = ({ show }) => (show ? <Badge tone="neutral" className="normal-case tracking-normal">Sample content</Badge> : null);
