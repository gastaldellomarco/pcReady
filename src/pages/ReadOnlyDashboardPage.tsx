import { useAuth } from '../hooks/useAuth';

export default function ReadOnlyDashboardPage() {
  const { profile } = useAuth();

  return (
    <div>
      <h1>Dashboard sola lettura</h1>
      <p>Utente: {profile?.full_name ?? profile?.email}</p>
      <p>Ruolo: {profile?.role}</p>
      <p>Questa area consente sola consultazione di KPI, ticket e storico.</p>
    </div>
  );
}