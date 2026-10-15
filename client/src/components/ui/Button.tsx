import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const classes = (variant: ButtonVariant, size: ButtonSize, className?: string) =>
  cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={classes(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

/** Link styled as a button. External/anchor hrefs render a plain <a>. */
export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, icon, ...rest }: Omit<LinkProps, 'to'> & { to: string; variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  const cls = classes(variant, size, className);
  if (/^(https?:|mailto:|tel:|#)/.test(to)) {
    const external = /^https?:/.test(to);
    return (
      <a href={to} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...(rest as object)}>
        {children}
        {icon}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} {...rest}>
      {children}
      {icon}
    </Link>
  );
}
