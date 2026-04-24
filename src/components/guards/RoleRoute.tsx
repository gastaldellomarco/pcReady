import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/auth';

interface Props {
  allowedRoles: UserRole[];
}

export function RoleRoute({ allowedRoles }: Props) {
  const { profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Verifica permessi in corso"
        style={{ padding: '24px', textAlign: 'center' }}
      >
        Loading permissions...
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    if (profile.role === 'viewer') {
      return <Navigate to="/dashboard/read-only" replace />;
    }

    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}