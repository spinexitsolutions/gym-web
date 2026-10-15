import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useSite } from '@/app/SiteProvider';

/** Split-screen shell for login/register/password flows. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { site, brandName } = useSite();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <Helmet>
        <title>{`${title} | ${brandName}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <aside className="relative hidden overflow-hidden border-r border-line/60 lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgb(var(--c-primary)/0.22),transparent_55%),radial-gradient(ellipse_at_90%_90%,rgb(var(--c-grad-to)/0.14),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(var(--c-text))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--c-text))_1px,transparent_1px)] [background-size:56px_56px]" />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 rounded-full bg-primary shadow-glow" />
        </motion.div>
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/[0.06]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="font-display text-sm font-semibold uppercase tracking-[0.3em]">
            {site?.settings.brand.shortName || brandName}
          </Link>
          <div>
            <p className="eyebrow mb-4">Members area</p>
            <p className="max-w-md font-display text-display-md font-semibold">Every session tracked. Every result earned.</p>
          </div>
        </div>
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted transition hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  return next;
}
