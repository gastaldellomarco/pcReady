import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { isAuthenticated, profile } = useAuth();

  if (isAuthenticated) {
    if (profile?.role === 'viewer') {
      return <Navigate to="/dashboard/read-only" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1>Accedi a PCReady</h1>
        <p style={{ color: '#666', marginBottom: 0 }}>
          Accedi con email e password
        </p>
      </div>

      <LoginForm />

      {/* Sign Up Link */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: '#f9f9f9',
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0 }}>
          Non hai un account?{' '}
          <a
            href="/signup"
            style={{
              color: '#007bff',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Registrati qui
          </a>
        </p>
      </div>
    </div>
  );
}