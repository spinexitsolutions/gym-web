import { z } from 'zod';

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().trim().max(40).optional(),
});
export type ListQuery = z.infer<typeof listQuery>;

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escapes user input for safe use inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parses `field` or `-field` against an allowlist. */
export function parseSort(sort: string | undefined, allowed: string[], fallback: Record<string, 1 | -1>): Record<string, 1 | -1> {
  if (!sort) return fallback;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowed.includes(field)) return fallback;
  return { [field]: desc ? -1 : 1 };
}
