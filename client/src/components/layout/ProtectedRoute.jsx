import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageLoader, ErrorState } from '../ui/States.jsx';

// UX guard only — every protected API route is also enforced on the server.
export function ProtectedRoute({ roles }) {
  const { user, loading, error, refetch } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (error && !user) return <div className="container py-24"><ErrorState message="Could not check your session." onRetry={refetch} /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && user.role !== 'owner' && !roles.includes(user.role)) return <Navigate to="/account" replace />;
  return <Outlet />;
}
