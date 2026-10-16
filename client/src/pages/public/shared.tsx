import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/layout/Reveal';

/** Closing call to action used on inner pages. */
export function CmsBottomCta({ title = 'Your first session is on us.', body = 'Tour the club, meet a coach and train a full session — no commitment.' }: { title?: string; body?: string }) {
  return (
    <section className="section pt-0" aria-label="Book a free trial">
      <div className="container">
        <Reveal className="glow-accent relative isolate overflow-hidden rounded-theme border border-fg/[0.08] px-6 py-14 md:px-14 md:py-20">
          <div aria-hidden className="metal-panel absolute inset-0 -z-10" />
          <div aria-hidden className="bg-aura absolute inset-0 -z-10" />
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-balance font-display text-display-md font-semibold">{title}</h2>
              <p className="mt-4 text-lg text-muted">{body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/#trial" className="btn btn-primary btn-lg group">
                Book a free trial <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link to="/memberships" className="btn btn-secondary btn-lg">
                Memberships
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="group mb-8 inline-flex items-center gap-2 text-sm text-muted transition hover:text-fg">
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden /> {children}
    </Link>
  );
}

/** Centered message for not-found / error states on detail pages. */
export function DetailMessage({ title, body, back }: { title: string; body: string; back: { to: string; label: string } }) {
  return (
    <section className="container flex min-h-[70svh] flex-col items-center justify-center pt-[var(--chrome-h,6rem)] text-center">
      <h1 className="font-display text-display-md font-semibold">{title}</h1>
      <p className="mt-4 max-w-md text-muted">{body}</p>
      <Link to={back.to} className="btn btn-secondary mt-8">
        {back.label}
      </Link>
    </section>
  );
}
