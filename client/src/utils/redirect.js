// Only allow same-site relative redirects (blocks //evil.com and absolute URLs).
export const safeNext = (next) => (next && /^\/(?!\/)/.test(next) ? next : null);

export function homeFor(user) {
  if (['owner', 'admin', 'staff'].includes(user?.role)) return '/admin';
  if (user?.role === 'trainer') return '/trainer';
  return '/dashboard';
}
