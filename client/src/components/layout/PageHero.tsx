import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

const ease = [0.2, 0.7, 0.2, 1] as const;

/** Header block for inner pages: clears the fixed chrome, big display title, quiet atmosphere. */
export function PageHero({ eyebrow, title, description, children, className, aside }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn('relative isolate overflow-hidden border-b border-fg/[0.06] pb-14 pt-[calc(var(--chrome-h,6rem)+3.5rem)] md:pb-20 md:pt-[calc(var(--chrome-h,6rem)+5.5rem)]', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-aura absolute inset-0" />
        <div className="bg-grid-fade absolute inset-0 opacity-60" />
      </div>
      <div className="container grid gap-10 lg:grid-cols-12 lg:items-end">
        <motion.div className="lg:col-span-8" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
          {eyebrow && <p className="eyebrow mb-6">{eyebrow}</p>}
          <h1 className="text-balance font-display text-display-xl font-semibold">{title}</h1>
          {description && <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted">{description}</p>}
        </motion.div>
        {aside && <div className="lg:col-span-4 lg:justify-self-end">{aside}</div>}
      </div>
      {children && <div className="container mt-10">{children}</div>}
    </section>
  );
}

/** Pill filter group (radio semantics via aria-pressed buttons). */
export function FilterChips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-full border px-4 py-2 text-sm transition', value === o.value ? 'border-primary bg-primary text-on-primary' : 'border-fg/15 text-fg/75 hover:border-fg/30 hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
