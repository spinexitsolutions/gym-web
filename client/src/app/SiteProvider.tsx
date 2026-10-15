import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_THEME } from '@apex/shared';
import { api } from '@/lib/api';
import { applyTheme } from '@/lib/theme';
import type { SiteBootstrap } from '@/types/api';

interface SiteContextValue {
  site: SiteBootstrap | undefined;
  isLoading: boolean;
  isError: boolean;
  brandName: string;
}

const SiteContext = createContext<SiteContextValue>({ site: undefined, isLoading: true, isError: false, brandName: 'Apex Athletics' });

/**
 * Loads published site settings + theme and applies them as CSS variables.
 * Polls the content version so newly published CMS changes appear without a rebuild or reload.
 */
export function SiteProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['site'], queryFn: () => api.get<SiteBootstrap>('/cms/site'), staleTime: 60_000 });

  // Theme preview frames (admin) pass ?themePreview=1 and receive tokens via postMessage instead.
  const isPreviewFrame = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('themePreview');

  useEffect(() => {
    if (isPreviewFrame) return;
    applyTheme(query.data?.theme ?? DEFAULT_THEME);
    if (query.data) (window as unknown as { __APEX_TZ__?: string }).__APEX_TZ__ = query.data.settings.business.timezone;
  }, [query.data, isPreviewFrame]);

  useEffect(() => {
    const fav = query.data?.settings.brand.faviconUrl;
    if (fav) document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', fav);
  }, [query.data?.settings.brand.faviconUrl]);

  // Lightweight publish detection: when contentVersion changes, refetch published content.
  useEffect(() => {
    if (!query.data) return;
    let current = query.data.contentVersion;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { contentVersion } = await api.get<{ contentVersion: number }>('/cms/version');
        if (contentVersion !== current) {
          current = contentVersion;
          await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'site' || q.queryKey[0] === 'public' });
        }
      } catch {
        /* offline — ignore */
      }
    };
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [query.data, qc]);

  const value = useMemo(
    () => ({ site: query.data, isLoading: query.isLoading, isError: query.isError, brandName: query.data?.settings.brand.name ?? 'Apex Athletics' }),
    [query.data, query.isLoading, query.isError],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
