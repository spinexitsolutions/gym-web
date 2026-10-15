import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Dashboard section card with an icon title and optional "see all" link. */
export function Panel({ title, icon, href, linkLabel = 'View all', action, children, className, bodyClassName, delay = 0 }: { title: ReactNode; icon?: ReactNode; href?: string; linkLabel?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] }} className={cn('card flex flex-col', className)}>
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/12 text-primary">{icon}</span>}
          {title}
        </h2>
        {action ??
          (href && (
            <Link to={href} className="inline-flex items-center gap-0.5 rounded-md text-xs font-medium text-muted transition hover:text-primary">
              {linkLabel} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
      </header>
      <div className={cn('flex-1 px-5 pb-5 pt-3', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/** Compact empty placeholder inside panels. */
export function MiniEmpty({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {icon && <span className="text-muted/80">{icon}</span>}
      <div>{children}</div>
      {action}
    </div>
  );
}

/** Small metric tile. */
export function Metric({ label, value, hint, icon, to, delay = 0 }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; to?: string; delay?: number }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
        {icon && <span className="text-primary/90">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight md:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      {to ? (
        <Link to={to} className="card block p-4 transition hover:border-primary/40 md:p-5">
          {body}
        </Link>
      ) : (
        <div className="card p-4 md:p-5">{body}</div>
      )}
    </motion.div>
  );
}
