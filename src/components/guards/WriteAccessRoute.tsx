import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function WriteAccessRoute() {
  const { canWrite, profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Verifica accesso in scrittura"
        style={{ padding: '24px', textAlign: 'center' }}
      >
        Checking write access...
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!canWrite) {
    return <Navigate to="/dashboard/read-only" replace />;
  }

  return <Outlet />;
}