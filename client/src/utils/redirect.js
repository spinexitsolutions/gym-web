// Only allow same-site relative redirects (blocks //evil.com and absolute URLs).
export const safeNext = (next) => (next && /^\/(?!\/)/.test(next) ? next : null);

export const homeFor = (user) => (['owner', 'admin', 'staff'].includes(user?.role) ? '/admin' : '/account');
