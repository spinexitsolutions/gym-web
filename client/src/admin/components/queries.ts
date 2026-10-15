import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Program } from '@/types/api';
import type { AdminPlan, AdminTrainer } from './types';

/** All plans (incl. archived) for admin pickers. */
export const usePlansAdmin = (enabled = true) => useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.get<AdminPlan[]>('/plans/admin'), enabled, staleTime: 60_000 });

/** All trainer profiles with user + assigned member counts. */
export const useTrainersAdmin = (enabled = true) => useQuery({ queryKey: ['admin', 'trainers'], queryFn: () => api.get<AdminTrainer[]>('/trainers/admin/all'), enabled, staleTime: 60_000 });

/** Programs (CMS) for class creation. Requires cms:write; fails soft. */
export const usePrograms = (enabled = true) =>
  useQuery({ queryKey: ['admin', 'programs'], queryFn: () => api.get<Program[]>('/cms/admin/programs', { limit: 100 }), enabled, staleTime: 5 * 60_000, retry: false });

export const trainerOptions = (list: AdminTrainer[] | undefined, activeOnly = true) =>
  (list ?? []).filter((t) => !activeOnly || t.user?.status === 'active').map((t) => ({ value: t.user._id, label: t.user.name }));
