import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-4 rounded-brand border border-danger/30 bg-danger/5 p-10 text-center', className)}>
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-1 text-sm text-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-brand border border-dashed border-line/15 p-10 text-center', className)}>
      <Icon className="h-8 w-8 text-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {action}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
    </div>
  );
}
