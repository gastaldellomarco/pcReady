import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function ReadOnlyRoute() {
  const { profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Caricamento profilo"
        style={{ padding: '24px', textAlign: 'center' }}
      >
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== 'viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}