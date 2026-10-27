import { Seo } from '../../components/layout/Seo.jsx';
import { Button } from '../../components/ui/Button.jsx';

export default function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" noindex />
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <p className="font-display text-8xl font-semibold text-gold-metal">404</p>
        <h1 className="mt-4 text-3xl font-semibold">This page has left the gym</h1>
        <p className="mt-3 text-muted">The page you are looking for doesn't exist or has moved.</p>
        <Button to="/" className="mt-8">Back to home</Button>
      </div>
    </>
  );
}
