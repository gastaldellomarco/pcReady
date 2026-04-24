import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface SignUpFormProps {
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);

    // Validazioni client-side
    if (password !== confirmPassword) {
      setErrorMessage('Le password non corrispondono.');
      setSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La password deve essere almeno 6 caratteri.');
      setSubmitting(false);
      return;
    }

    try {
      // 1. Registra l'utente con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          },
        },
      });

      if (authError) {
        console.error('[SIGNUP ERROR]', authError);
        setErrorMessage('Registrazione non riuscita. Riprova.');
        setSubmitting(false);
        return;
      }

      if (!authData.user) {
        setErrorMessage('Errore durante la registrazione. Riprova.');
        setSubmitting(false);
        return;
      }

      // 2. Crea il profilo nell'RLS protected table
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          email: authData.user.email,
          full_name: fullName || email.split('@')[0],
          role: 'viewer', // Default role per nuovi utenti
          is_active: true,
        },
      ]);

      if (profileError) {
        console.error('[PROFILE ERROR]', profileError);
        // Non bloccare se il profilo fallisce - l'admin può creare manualmente
        setSuccessMessage(
          'Registrazione completata! Verifica la tua email per confermare.'
        );
      } else {
        setSuccessMessage(
          'Registrazione completata! Verifica la tua email per confermare.'
        );
      }

      // 3. Pulisci form e reindirizza dopo 2 secondi
      setTimeout(() => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/login', { replace: true });
        }
      }, 2000);
    } catch (error: any) {
      console.error('[SIGNUP EXCEPTION]', error);
      setErrorMessage(
        'Errore durante la registrazione. Verifica i dati e riprova.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      {/* Full Name */}
      <div>
        <label htmlFor="fullName">Nome Completo (opzionale)</label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="es. Marco Rossi"
          style={{ display: 'block', width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="es. marco@example.com"
          style={{ display: 'block', width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password">Password (min 6 caratteri)</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Inserisci una password sicura"
          style={{ display: 'block', width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword">Conferma Password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Ripeti la password"
          style={{ display: 'block', width: '100%', padding: 8, boxSizing: 'border-box' }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            color: 'crimson',
            padding: 10,
            border: '1px solid crimson',
            borderRadius: 4,
            backgroundColor: 'rgba(220, 20, 60, 0.1)',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div
          role="status"
          style={{
            color: 'green',
            padding: 10,
            border: '1px solid green',
            borderRadius: 4,
            backgroundColor: 'rgba(34, 139, 34, 0.1)',
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: 10,
          backgroundColor: submitting ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: submitting ? 'not-allowed' : 'pointer',
          fontSize: '1em',
        }}
      >
        {submitting ? 'Registrazione in corso...' : 'Registrati'}
      </button>

      {/* Link to Login */}
      <div style={{ textAlign: 'center', fontSize: '0.9em', marginTop: 8 }}>
        <p>
          Hai già un account?{' '}
          <a
            href="/login"
            style={{ color: '#007bff', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Accedi qui
          </a>
        </p>
      </div>
    </form>
  );
}
