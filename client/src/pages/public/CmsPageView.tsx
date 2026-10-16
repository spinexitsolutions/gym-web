import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import type { PublishedPage } from '@/types/api';
import { Seo } from '@/components/layout/Seo';
import { PageRenderer } from '@/features/sections/PageRenderer';
import { QuietError } from '@/features/sections/primitives';
import { Skeleton } from '@/components/ui';
import NotFoundPage from './NotFoundPage';

export const publishedPageQuery = (slug: string) => ({
  queryKey: ['public', 'page', slug],
  queryFn: () => api.get<PublishedPage>(`/pages/public/${encodeURIComponent(slug)}`),
  staleTime: 60_000,
});

/** Loading state that keeps the hero's footprint, avoiding a layout jump when content arrives. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="container flex min-h-[100svh] flex-col justify-center gap-6 pt-[var(--chrome-h,6rem)]">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-20 w-full max-w-2xl" />
      <Skeleton className="h-20 w-full max-w-xl" />
      <Skeleton className="h-5 w-full max-w-lg" />
    </div>
  );
}

/** Renders a published CMS page by slug ("home" resolves to the home page). */
export function CmsPageView({ slug, home = false }: { slug: string; home?: boolean }) {
  const q = useQuery(publishedPageQuery(slug));
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFoundPage />;
    return (
      <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+4rem)]">
        <QuietError what="This page’s contents" onRetry={() => q.refetch()} />
      </div>
    );
  }
  const page = q.data!;
  return (
    <>
      <Seo title={home ? page.seo.title || undefined : page.seo.title || page.title} description={page.seo.description} image={page.seo.image || page.featuredImage} noIndex={page.seo.noIndex} structuredData={home} />
      <PageRenderer sections={page.sections} />
    </>
  );
}
