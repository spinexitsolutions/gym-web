import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../services/content.js';

export const SETTINGS_KEY = ['settings', 'public'];

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: contentApi.settings, staleTime: 60_000 });
}
