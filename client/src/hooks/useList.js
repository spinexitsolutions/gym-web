import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useDebounced } from './useDebounced.js';

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString();
  return s ? `?${s}` : '';
};
export { qs };

/**
 * Paginated list whose filters live in the URL (shareable, back-button friendly).
 * Returns { rows, meta, query, params, set } — set({ key: value }) updates a filter and resets the page.
 */
export function useList(endpoint, { defaults = {}, key } = {}) {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => ({ ...defaults, ...Object.fromEntries(search.entries()) }), [search, defaults]);
  const q = useDebounced(params.q || '', 300);
  const effective = { ...params, q };
  const query = useQuery({
    queryKey: [key || endpoint, effective],
    queryFn: () => api.get(`${endpoint}${qs(effective)}`),
    placeholderData: keepPreviousData,
  });
  const set = useCallback((patch) => {
    const next = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === '' || v === null ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setSearch(next, { replace: true });
  }, [search, setSearch]);
  return { rows: query.data?.data || [], meta: query.data?.meta, query, params, set };
}
