import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { Button } from './Button';

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-theme border border-dashed border-line px-6 py-12 text-center', className)}>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-fg/5 text-muted">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, title = 'Couldn’t load this' }: { error?: unknown; onRetry?: () => void; className?: string; title?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center rounded-theme border border-danger/30 bg-danger/5 px-6 py-10 text-center', className)}>
      <AlertTriangle className="mb-3 h-6 w-6 text-danger" />
      <h3 className="font-semibold">{title}</h3>
      {error !== undefined && <p className="mt-1 text-sm text-muted">{errorMessage(error)}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('relative overflow-hidden rounded-theme-sm bg-fg/[0.06] before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-fg/[0.06] before:to-transparent', className)} />;
}

export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'success' | 'warning' | 'danger'; title?: ReactNode; children?: ReactNode; className?: string }) {
  const map = { info: 'border-sky-400/30 bg-sky-400/5', success: 'border-success/30 bg-success/5', warning: 'border-warning/30 bg-warning/5', danger: 'border-danger/30 bg-danger/5' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-theme-sm border px-4 py-3 text-sm', map[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn('text-fg/80', title && 'mt-0.5')}>{children}</div>}
    </div>
  );
}
