import type { ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';

const ease = [0.2, 0.7, 0.2, 1] as const;

/**
 * Subtle reveal-on-scroll (once). MotionConfig reducedMotion="user" (main.tsx) turns the
 * translate off for people who prefer reduced motion; only the fade remains.
 */
export function Reveal({ children, className, delay = 0, y = 22, as = 'div' }: { children: ReactNode; className?: string; delay?: number; y?: number; as?: 'div' | 'li' | 'article' }) {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -8% 0px' }} transition={{ duration: 0.8, delay, ease }}>
      {children}
    </M>
  );
}

const group: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };

/** Staggered group: wrap children in <RevealItem>. */
export function RevealGroup({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const M = motion[as];
  return (
    <M className={className} variants={group} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -8% 0px' }}>
      {children}
    </M>
  );
}

export function RevealItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const M = motion[as];
  return (
    <M className={className} variants={item}>
      {children}
    </M>
  );
}
