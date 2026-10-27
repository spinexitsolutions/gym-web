import { Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header.jsx';
import { Footer } from '../components/layout/Footer.jsx';
import { AnnouncementBar } from '../components/layout/AnnouncementBar.jsx';
import { WhatsAppButton } from '../components/layout/WhatsAppButton.jsx';
import { useSettings } from '../hooks/useSettings.js';
import { ErrorState, PageLoader } from '../components/ui/States.jsx';

export function PublicLayout() {
  const { isLoading, isError, refetch } = useSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[60] rounded bg-gold px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="flex-1">
        {isLoading ? (
          <PageLoader />
        ) : isError ? (
          <div className="container py-24">
            <ErrorState title="We couldn't load the website" message="The server may be starting up. Please try again in a moment." onRetry={refetch} />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
