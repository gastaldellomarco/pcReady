import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function Topbar(): JSX.Element {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async (): Promise<void> => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <div>
        <div className="topbar__title">Dashboard operativa</div>
        <div className="text-muted">
          Utente: {user?.email ?? 'non disponibile'}
        </div>
      </div>

      <div className="topbar__actions">
        <button type="button" className="btn btn--ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Topbar;