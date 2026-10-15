import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permission, Role } from '@apex/shared';
import { PageLoader } from '@/components/ui';
import { homeForRole, useAuth } from './AuthProvider';

/** Client-side route guard (UX only — the API enforces every permission server-side). */
export function RequireAuth({ roles, permission, children }: { roles?: Role[]; permission?: Permission; children: ReactNode }) {
  const { user, isLoading, can } = useAuth();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  if (permission && !can(permission)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}
