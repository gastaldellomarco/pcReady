import { Navigate } from 'react-router-dom';
import { SignUpForm } from '../components/auth/SignUpForm';
import { useAuth } from '../hooks/useAuth';

export default function SignUpPage() {
  const { isAuthenticated, profile } = useAuth();

  // Se l'utente è già loggato, reindirizza al dashboard
  if (isAuthenticated) {
    if (profile?.role === 'viewer') {
      return <Navigate to="/dashboard/read-only" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1>Crea un nuovo account</h1>
        <p style={{ color: '#666', marginBottom: 0 }}>
          Registrati per iniziare a usare PCReady
        </p>
      </div>

      <SignUpForm />

      {/* Info Box */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          backgroundColor: '#f0f8ff',
          border: '1px solid #007bff',
          borderRadius: 8,
        }}
      >
        <h3 style={{ margin: '0 0 8px 0' }}>ℹ️ Nota Importante</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#555' }}>
          <li>La registrazione è aperta. Nuovi utenti hanno ruolo "viewer" per impostazione predefinita.</li>
          <li>L'amministratore può modificare il tuo ruolo (viewer, tech, admin) dopo l'approvazione.</li>
          <li>Verifica la tua email per confermare l'account.</li>
        </ul>
      </div>
    </div>
  );
}
