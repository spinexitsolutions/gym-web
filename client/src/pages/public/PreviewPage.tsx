import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import type { DraftSection, ThemeTokens } from '@apex/shared';
import { api } from '@/lib/api';
import { applyTheme } from '@/lib/theme';
import type { PublishedPage } from '@/types/api';
import { Seo } from '@/components/layout/Seo';
import { PageRenderer } from '@/features/sections/PageRenderer';
import { QuietError } from '@/features/sections/primitives';
import { PageSkeleton } from './CmsPageView';

interface DraftPage {
  id: string;
  title: string;
  slug: string;
  sections: DraftSection[];
  validation?: { ok: boolean; errors: unknown[] };
}

type PreviewMessage = { type: 'apex-preview'; sections?: DraftSection[]; theme?: ThemeTokens };

const isPreviewMessage = (d: unknown): d is PreviewMessage => typeof d === 'object' && d !== null && (d as { type?: unknown }).type === 'apex-preview';

/**
 * Admin draft preview (/preview/:pageId, guarded by cms:write).
 *  - Loads the saved draft (GET /pages/:id), or the published home page for `home-theme`.
 *  - Accepts live updates from the CMS builder iframe parent via same-origin postMessage:
 *    { type: 'apex-preview', sections?, theme? }. Posts { type: 'apex-preview-ready' } on mount.
 *  - With ?themePreview=1 SiteProvider skips the published theme so the posted theme wins.
 */
export default function PreviewPage() {
  const { pageId = '' } = useParams();
  const themeMode = pageId === 'home-theme';
  const q = useQuery({
    queryKey: ['preview', pageId],
    queryFn: (): Promise<Pick<DraftPage, 'title' | 'sections'>> => (themeMode ? api.get<PublishedPage>('/pages/public/home') : api.get<DraftPage>(`/pages/${encodeURIComponent(pageId)}`)),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const [live, setLive] = useState<DraftSection[] | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !isPreviewMessage(e.data)) return;
      if (Array.isArray(e.data.sections)) setLive(e.data.sections);
      if (e.data.theme && typeof e.data.theme === 'object') {
        try {
          applyTheme(e.data.theme);
        } catch (err) {
          console.warn('[preview] invalid theme payload', err);
        }
      }
    };
    window.addEventListener('message', onMessage);
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'apex-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const sections = live ?? q.data?.sections ?? [];
  return (
    <>
      <Seo title={`Preview: ${q.data?.title ?? 'Draft'}`} noIndex />
      <div role="status" className="pointer-events-none fixed bottom-4 left-1/2 z-[95] -translate-x-1/2">
        <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-bg/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-warning shadow-theme backdrop-blur">
          <Eye className="h-3.5 w-3.5" aria-hidden /> {themeMode ? 'Theme preview' : 'Draft preview'}
          {live && <span className="font-normal normal-case tracking-normal text-muted">· live</span>}
        </span>
      </div>
      {q.isLoading && !live ? (
        <PageSkeleton />
      ) : q.isError && !live ? (
        <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+4rem)]">
          <QuietError what="This draft" onRetry={() => q.refetch()} />
        </div>
      ) : sections.length === 0 ? (
        <div className="container pb-24 pt-[calc(var(--chrome-h,6rem)+4rem)] text-center text-muted">This page has no sections yet — add one in the builder.</div>
      ) : (
        <PageRenderer sections={sections} preview />
      )}
    </>
  );
}
