import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { profile, canWrite } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Benvenuto {profile?.full_name ?? profile?.email}</p>
      <p>Ruolo: {profile?.role}</p>
      <p>Permessi scrittura: {canWrite ? 'Sì' : 'No'}</p>
    </div>
  );
}