import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import type { BlogPostSummary } from '@/types/api';
import { Seo } from '@/components/layout/Seo';
import { FilterChips, PageHero } from '@/components/layout/PageHero';
import { RevealGroup, RevealItem } from '@/components/layout/Reveal';
import { Pagination } from '@/components/ui';
import { PostCard } from '@/features/sections/cards';
import { CardSkeletons, QuietError } from '@/features/sections/primitives';

const LIMIT = 9;

export default function BlogPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = useQuery({
    queryKey: ['public', 'blog', 'list', category, page],
    queryFn: () => api.getPaged<BlogPostSummary[]>('/blog', { limit: LIMIT, page, category: category || undefined }),
    placeholderData: (prev) => prev,
  });
  const categories = ((q.data?.meta?.categories as string[] | undefined) ?? []).slice().sort();
  const posts = q.data?.data ?? [];
  const set = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p);
    window.scrollTo({ top: 0 });
  };
  const featured = page === 1 && !category ? posts[0] : undefined;
  const rest = featured ? posts.slice(1) : posts;

  return (
    <>
      <Seo title={category ? `${titleCase(category)} — Journal` : 'Journal'} description="Training, nutrition and recovery notes from our coaching team." />
      <PageHero eyebrow="Journal" title="Training notes." description="Programming insight, nutrition fundamentals and recovery habits from the coaching team.">
        {categories.length > 0 && (
          <FilterChips label="Filter by category" options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: titleCase(c) }))]} value={category} onChange={(v) => set({ category: v, page: '' })} />
        )}
      </PageHero>
      <section className="section" aria-label="Articles">
        <div className="container">
          {q.isLoading ? (
            <CardSkeletons count={6} />
          ) : q.isError ? (
            <QuietError what="Articles" onRetry={() => q.refetch()} />
          ) : posts.length === 0 ? (
            <p className="py-16 text-center text-muted">No articles here yet.</p>
          ) : (
            <>
              {featured && (
                <div className="mb-16 border-b border-fg/[0.08] pb-16">
                  <PostCard post={featured} large />
                </div>
              )}
              <RevealGroup className="grid gap-x-6 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <RevealItem key={post._id}>
                    <PostCard post={post} />
                  </RevealItem>
                ))}
              </RevealGroup>
              {q.data?.meta && <div className="mt-16"><Pagination page={page} pages={q.data.meta.pages} onPage={(p) => set({ page: String(p) })} /></div>}
            </>
          )}
        </div>
      </section>
    </>
  );
}
