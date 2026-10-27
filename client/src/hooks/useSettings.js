import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../services/content.js';
import { api } from '../services/api.js';

export const SETTINGS_KEY = ['settings', 'public'];
const PREVIEW_FLAG = 'aurum-preview';

// Admins can preview the unpublished draft on the real site with ?preview=draft (kept for the browser tab).
export function previewMode() {
  try {
    if (new URLSearchParams(window.location.search).get('preview') === 'draft') sessionStorage.setItem(PREVIEW_FLAG, '1');
    return sessionStorage.getItem(PREVIEW_FLAG) === '1';
  } catch {
    return false;
  }
}

export function exitPreview() {
  try { sessionStorage.removeItem(PREVIEW_FLAG); } catch { /* ignore */ }
  window.location.href = window.location.pathname;
}

async function fetchSettings() {
  if (previewMode()) {
    try {
      const draft = (await api.get('/settings/draft')).data.draft;
      return { ...draft, banners: [], isPreview: true };
    } catch {
      try { sessionStorage.removeItem(PREVIEW_FLAG); } catch { /* ignore */ }
    }
  }
  return contentApi.settings();
}

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings, staleTime: 60_000 });
}
