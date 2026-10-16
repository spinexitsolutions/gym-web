import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { CustomCursor } from '@/components/layout/CustomCursor';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { CookieNotice, PromoPopup, ScrollManager } from '@/components/layout/SiteOverlays';
import { RouteErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PageLoader } from '@/components/ui';
import '@/components/layout/public.css';

/** Public website chrome: skip link, announcement + header, page outlet, footer, overlays. */
export default function PublicLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <a href="#main" className="sr-only z-[200] rounded-btn bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <ScrollManager />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <RouteErrorBoundary>
          <Suspense fallback={<div className="pt-[var(--chrome-h,6rem)]"><PageLoader /></div>}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Footer />
      <CustomCursor />
      <PromoPopup />
      <CookieNotice />
    </div>
  );
}
