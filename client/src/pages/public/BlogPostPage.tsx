import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { fmtDate, titleCase } from '@/lib/format';
import type { BlogPost } from '@/types/api';
import { useSite } from '@/app/SiteProvider';
import { Seo } from '@/components/layout/Seo';
import { Reveal } from '@/components/layout/Reveal';
import { Skeleton } from '@/components/ui';
import { Img, Markdown, QuietError } from '@/features/sections/primitives';
import { BackLink, CmsBottomCta, DetailMessage } from './shared';

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const { brandName } = useSite();
  const q = useQuery({ queryKey: ['public', 'blog', 'post', slug], queryFn: () => api.get<BlogPost>(`/blog/post/${encodeURIComponent(slug)}`) });

  if (q.isLoading)
    return (
      <div className="container max-w-3xl space-y-6 pb-24 pt-[calc(var(--chrome-h,6rem)+5rem)]">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (q.isError)
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <DetailMessage title="Article not found" body="It may have been unpublished or moved." back={{ to: '/blog', label: 'Back to the journal' }} />
    ) : (
      <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+5rem)]">
        <QuietError what="This article" onRetry={() => q.refetch()} />
      </div>
    );

  const post = q.data!;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.publishedAt,
    author: post.authorName ? { '@type': 'Person', name: post.authorName } : { '@type': 'Organization', name: brandName },
    publisher: { '@type': 'Organization', name: brandName },
    image: post.coverImage || undefined,
    description: post.excerpt || undefined,
  };
  return (
    <>
      <Seo title={post.seo?.title || post.title} description={post.seo?.description || post.excerpt} image={post.seo?.image || post.coverImage} noIndex={post.seo?.noIndex} type="article" publishedTime={post.publishedAt} jsonLd={[jsonLd]} />
      <article>
        <header className="relative isolate overflow-hidden pb-12 pt-[calc(var(--chrome-h,6rem)+3rem)] md:pb-16">
          <div aria-hidden className="bg-aura pointer-events-none absolute inset-0 -z-10" />
          <div className="container max-w-3xl">
            <BackLink to="/blog">Journal</BackLink>
            <p className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {post.category && (
                <Link to={`/blog?category=${encodeURIComponent(post.category)}`} className="text-primary hover:underline">
                  {titleCase(post.category)}
                </Link>
              )}
              <time dateTime={post.publishedAt}>{fmtDate(post.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {post.readingMinutes} min read
              </span>
            </p>
            <h1 className="mt-6 text-balance font-display text-display-lg font-semibold">{post.title}</h1>
            {post.excerpt && <p className="mt-6 text-pretty text-xl leading-relaxed text-muted">{post.excerpt}</p>}
            {post.authorName && <p className="mt-8 border-t border-fg/[0.08] pt-5 text-sm text-fg/80">By {post.authorName}</p>}
          </div>
        </header>
        {post.coverImage && (
          <Reveal className="container mb-14 max-w-5xl">
            <div className="aspect-[16/9] overflow-hidden rounded-theme border border-fg/[0.08]">
              <Img src={post.coverImage} alt="" />
            </div>
          </Reveal>
        )}
        <div className="container max-w-3xl pb-20">
          <Markdown>{post.content}</Markdown>
          {post.tags.length > 0 && (
            <ul className="mt-14 flex flex-wrap gap-2 border-t border-fg/[0.08] pt-8" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t} className="rounded-full border border-fg/10 px-3 py-1 text-xs text-muted">
                  #{t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
      <CmsBottomCta />
    </>
  );
}
