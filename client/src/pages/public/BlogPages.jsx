import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { api } from '../../services/api.js';
import { Seo } from '../../components/layout/Seo.jsx';
import { PageHero } from '../../components/sections/PageHero.jsx';
import { Section } from '../../components/ui/Section.jsx';
import { Img } from '../../components/ui/Img.jsx';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '../../components/ui/States.jsx';
import { formatDate } from '../../utils/format.js';
import { Pagination } from './ProgramsPage.jsx';
import NotFoundPage from './NotFoundPage.jsx';
import { cn } from '../../utils/cn.js';

function PostCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-brand border border-line/10 bg-surface transition hover:-translate-y-1 hover:border-gold/40">
      <Img image={post.coverImage} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs text-muted">{formatDate(post.publishedAt)}{post.tags?.length ? ` · ${post.tags.slice(0, 2).join(', ')}` : ''}</p>
        <h2 className="mt-2 text-xl font-semibold group-hover:text-gold">{post.title}</h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{post.excerpt}</p>
      </div>
    </Link>
  );
}

export function BlogPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const tag = params.get('tag') || '';
  const q = useQuery({ queryKey: ['blog', page, tag], queryFn: () => api.get(`/blogs?page=${page}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`), placeholderData: keepPreviousData });
  return (
    <>
      <Seo title="Journal" description="Training guides, nutrition advice and club news from our coaches." path="/blog" />
      <PageHero eyebrow="Journal" title="Training notes from our coaches" lead="Practical, evidence-based articles on strength, conditioning, recovery and nutrition." />
      <Section className="pt-12 md:pt-16">
        {q.data?.meta?.tags?.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {['', ...q.data.meta.tags].map((t) => (
              <button key={t || 'all'} type="button" aria-pressed={tag === t} onClick={() => setParams(t ? { tag: t } : {})}
                className={cn('rounded-full border px-4 py-1.5 text-xs capitalize', tag === t ? 'border-gold bg-gold/15 text-gold' : 'border-line/15 text-muted hover:text-ink')}>{t || 'All'}</button>
            ))}
          </div>
        )}
        {q.isError ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : q.isLoading ? <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80" />)}</div>
          : !q.data.data.length ? <EmptyState title="No articles yet" message="Our coaches are writing — check back soon." /> : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{q.data.data.map((p) => <PostCard key={p._id} post={p} />)}</div>
              <Pagination meta={q.data.meta} onPage={(p) => setParams({ ...(tag && { tag }), page: String(p) })} />
            </>
          )}
      </Section>
    </>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['blog', slug], queryFn: async () => (await api.get(`/blogs/${slug}`)).data, retry: (n, e) => e.status !== 404 && n < 2 });
  if (q.isLoading) return <PageLoader />;
  if (q.error?.status === 404) return <NotFoundPage />;
  if (q.isError) return <div className="container py-24"><ErrorState message={q.error.message} onRetry={q.refetch} /></div>;
  const p = q.data;
  return (
    <>
      <Seo title={p.seo?.title || p.title} description={p.seo?.description || p.excerpt} image={p.coverImage?.url} path={`/blog/${p.slug}`}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.publishedAt, dateModified: p.updatedAt, author: { '@type': 'Person', name: p.author?.name }, image: p.coverImage?.url }} />
      <article className="container max-w-3xl py-16 md:py-24">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted"><Link to="/blog" className="hover:text-gold">Journal</Link></nav>
        <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">{p.title}</h1>
        <p className="mt-4 text-sm text-muted">{p.author?.name && `${p.author.name} · `}{formatDate(p.publishedAt)}</p>
        {p.coverImage?.url && <Img image={p.coverImage} priority sizes="(min-width: 768px) 768px, 100vw" className="mt-10 aspect-[16/9] w-full rounded-brand" />}
        {/* Markdown is rendered without raw HTML (react-markdown's default), so stored content cannot inject scripts. */}
        <div className="prose-aurum mt-10">
          <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} className="text-gold underline underline-offset-4" target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a> }}>{p.content || ''}</ReactMarkdown>
        </div>
        {p.tags?.length > 0 && <div className="mt-10 flex flex-wrap gap-2">{p.tags.map((t) => <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line/15 px-3 py-1 text-xs capitalize text-muted hover:border-gold hover:text-gold">{t}</Link>)}</div>}
      </article>
      {p.related?.length > 0 && (
        <Section className="border-t border-line/10 pt-16">
          <h2 className="mb-8 text-2xl font-semibold">Keep reading</h2>
          <div className="grid gap-6 md:grid-cols-3">{p.related.map((r) => <PostCard key={r._id} post={r} />)}</div>
        </Section>
      )}
    </>
  );
}
