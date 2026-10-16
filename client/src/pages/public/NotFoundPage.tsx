import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Seo } from '@/components/layout/Seo';

export default function NotFoundPage() {
  return (
    <section className="relative isolate flex min-h-[80svh] items-center overflow-hidden pt-[var(--chrome-h,6rem)]">
      <Seo title="Page not found" noIndex />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-aura absolute inset-0" />
        <div className="bg-grid-fade absolute inset-0 opacity-60" />
      </div>
      <p aria-hidden className="text-outline pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none font-display text-[38vw] font-semibold leading-none tracking-tighter opacity-70">
        404
      </p>
      <div className="container py-24 text-center">
        <p className="eyebrow mb-6 justify-center">Error 404</p>
        <h1 className="mx-auto max-w-3xl text-balance font-display text-display-lg font-semibold">This page skipped leg day.</h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted">The page you’re looking for doesn’t exist or has moved.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn btn-primary btn-lg">
            Back to home <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/programs" className="btn btn-secondary btn-lg">
            Explore programs
          </Link>
        </div>
      </div>
    </section>
  );
}
