import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function AppShell() {
  const { profile, signOut, canWrite, isAdmin, isTech, isViewer } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <strong>PCReady</strong>

        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/dashboard">Dashboard</Link>
            <Link to="/docs">Docs</Link>
          {isViewer && <Link to="/dashboard/read-only">Dashboard Viewer</Link>}
          {isTech && <Link to="/tech">Tech Area</Link>}
          {isAdmin && <Link to="/admin">Admin Area</Link>}
          {canWrite && <Link to="/tickets/new">Nuovo Ticket</Link>}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>
            {profile?.full_name ?? profile?.email} · role: <b>{profile?.role}</b>
          </span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}