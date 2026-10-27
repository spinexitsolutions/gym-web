import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const VARIANTS = {
  primary: 'bg-gold-metal text-[#0B0B0C] shadow-glow hover:brightness-110',
  outline: 'border border-gold/60 text-ink hover:bg-gold/10 hover:border-gold',
  ghost: 'text-ink hover:bg-ink/5',
  subtle: 'bg-elevated text-ink hover:bg-elevated/70 border border-line/10',
  danger: 'bg-danger/90 text-white hover:bg-danger',
};
const SIZES = { sm: 'h-9 px-4 text-xs', md: 'h-11 px-6 text-sm', lg: 'h-14 px-8 text-sm' };

const isExternal = (href) => /^(https?:|mailto:|tel:)/.test(href);

export const Button = forwardRef(function Button(
  { as, to, href, variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-brand font-semibold uppercase tracking-[0.14em] transition duration-200 select-none',
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
    VARIANTS[variant], SIZES[size], className,
  );
  const content = (
    <>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </>
  );
  const target = to || href;
  if (target && !disabled) {
    if (isExternal(target)) {
      return <a ref={ref} href={target} className={classes} target={target.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" {...props}>{content}</a>;
    }
    return <Link ref={ref} to={target} className={classes} {...props}>{content}</Link>;
  }
  const Comp = as || 'button';
  return (
    <Comp ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </Comp>
  );
});
