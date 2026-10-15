import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors (including failed lazy chunk loads after a deploy) and offers a reload. */
export class RouteErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="eyebrow">{chunk ? 'Update available' : 'Something went wrong'}</p>
        <h1 className="font-display text-3xl font-semibold">{chunk ? 'A new version of the site is ready' : 'This page hit an unexpected error'}</h1>
        <p className="max-w-md text-muted">{chunk ? 'Reload to get the latest version.' : 'Please reload the page. If it keeps happening, contact us.'}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
