import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function LoginForm() {
  const { signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await signInWithPassword(email, password);
      navigate(from || '/dashboard', { replace: true });
    } catch (error: any) {
      // ⚠️ Non mostrare errori specifici (user enumeration vulnerability)
      // Log interno per debugging
      console.error('[AUTH ERROR]', error);
      setErrorMessage('Email o password non corretti. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', padding: 8 }}
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', padding: 8 }}
        />
      </div>

      {errorMessage && (
        <div style={{ color: 'crimson' }}>
          {errorMessage}
        </div>
      )}

      <button type="submit" disabled={submitting} style={{ padding: 10 }}>
        {submitting ? 'Accesso in corso...' : 'Login'}
      </button>
    </form>
  );
}