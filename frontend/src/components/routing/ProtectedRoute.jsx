/**
 * ProtectedRoute.jsx
 * ==================
 * Wraps a route with auth + role guard.
 *
 * Props:
 *   role — required role string ("DOCTOR" | "NURSE")
 *           if omitted, any authenticated user passes
 *
 * Behaviour:
 *   loading → show skeleton
 *   not authenticated → redirect to /login
 *   wrong role → redirect to their own portal
 *   correct → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageSkeleton } from '../ui/Skeleton';

const ROLE_HOME = { DOCTOR: '/doctor', NURSE: '/nurse' };

export function ProtectedRoute({ children, role }) {
  const { isAuthenticated, loading, role: userRole } = useAuth();

  if (loading) return <PageSkeleton />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Wrong role → send to correct portal
  if (role && userRole !== role) {
    return <Navigate to={ROLE_HOME[userRole] || '/login'} replace />;
  }

  return children;
}
