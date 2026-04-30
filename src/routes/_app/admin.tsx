import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { MailPlus, Search, Trash2, UserCog, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth-context";
import {
  deleteAdminUser,
  inviteAdminUser,
  listAdminUsers,
  setAdminUserDisabled,
  updateAdminUser,
  type AdminUserRow,
} from "@/lib/admin-users";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Utenti - PCReady" },
      { name: "description", content: "Gestione utenti, ruoli e stato account." },
    ],
  }),
  component: AdminUsersPage,
});

const ROLES: AppRole[] = ["admin", "tech", "viewer"];

function AdminUsersPage() {
  const { isAdmin, loading, session, user } = useAuth();
  const navigate = useNavigate();
  const listUsers = useServerFn(listAdminUsers);
  const updateUser = useServerFn(updateAdminUser);
  const setDisabled = useServerFn(setAdminUserDisabled);
  const deleteUser = useServerFn(deleteAdminUser);
  const inviteUser = useServerFn(inviteAdminUser);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [loadingRows, setLoadingRows] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("viewer");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  async function load() {
    if (!session?.access_token || !isAdmin) return;
    setLoadingRows(true);
    try {
      const data = await listUsers({ data: { accessToken: session.access_token } });
      setRows(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare gli utenti");
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => { load(); }, [session?.access_token, isAdmin]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(row => {
      const matchesText = !needle || `${row.full_name} ${row.email}`.toLowerCase().includes(needle);
      const matchesRole = !role || row.role === role;
      return matchesText && matchesRole;
    });
  }, [q, role, rows]);

  async function saveRole(row: AdminUserRow, nextRole: AppRole) {
    if (!session?.access_token || row.role === nextRole) return;
    setBusyId(row.id);
    try {
      await updateUser({
        data: {
          accessToken: session.access_token,
          userId: row.id,
          role: nextRole,
          fullName: row.full_name,
          initials: row.initials,
        },
      });
      toast.success("Ruolo aggiornato");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aggiornamento non riuscito");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDisabled(row: AdminUserRow) {
    if (!session?.access_token) return;
    const disabled = row.status !== "disabled";
    setBusyId(row.id);
    try {
      await setDisabled({ data: { accessToken: session.access_token, userId: row.id, disabled } });
      toast.success(disabled ? "Utente disabilitato" : "Utente riabilitato");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operazione non riuscita");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: AdminUserRow) {
    if (!session?.access_token) return;
    if (!confirm(`Rimuovere definitivamente ${row.email || row.full_name}?`)) return;
    setBusyId(row.id);
    try {
      await deleteUser({ data: { accessToken: session.access_token, userId: row.id } });
      toast.success("Utente rimosso");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rimozione non riuscita");
    } finally {
      setBusyId(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;
    setInviteBusy(true);
    try {
      await inviteUser({
        data: {
          accessToken: session.access_token,
          email: inviteEmail,
          fullName: inviteName,
          role: inviteRole,
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      toast.success("Invito inviato");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invito non riuscito");
    } finally {
      setInviteBusy(false);
    }
  }

  if (loading || !isAdmin) {
    return <div className="text-text3 text-sm">Verifica permessi...</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <form className="pc-card p-4 flex flex-wrap items-end gap-3" onSubmit={invite}>
        <div className="flex-1 min-w-[220px]">
          <label className="pc-label">Email nuovo utente</label>
          <input
            className="pc-input"
            type="email"
            required
            value={inviteEmail}
            onChange={event => setInviteEmail(event.target.value)}
            placeholder="utente@azienda.it"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="pc-label">Nome</label>
          <input
            className="pc-input"
            value={inviteName}
            onChange={event => setInviteName(event.target.value)}
            placeholder="Mario Rossi"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="pc-label">Ruolo</label>
          <select className="pc-input" value={inviteRole} onChange={event => setInviteRole(event.target.value as AppRole)}>
            {ROLES.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
        </div>
        <button className="pc-btn pc-btn-primary" disabled={inviteBusy} type="submit">
          <MailPlus className="w-3.5 h-3.5" /> {inviteBusy ? "Invio..." : "Invita"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] flex-1 min-w-[220px] max-w-[360px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          <Search className="w-3 h-3 text-text3" />
          <input
            value={q}
            onChange={event => setQ(event.target.value)}
            placeholder="Cerca nome o email..."
            className="bg-transparent outline-none text-[13px] flex-1"
          />
        </div>
        <select className="pc-input max-w-[180px]" value={role} onChange={event => setRole(event.target.value)}>
          <option value="">Tutti i ruoli</option>
          {ROLES.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-text3 font-mono">{filtered.length} utenti</span>
      </div>

      <div className="pc-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["Nome", "Email", "Ruolo", "Stato", "Azioni"].map(header => (
                <th
                  key={header}
                  className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                  style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingRows && (
              <tr><td colSpan={5} className="text-center py-10 text-text3 text-sm">Caricamento utenti...</td></tr>
            )}
            {!loadingRows && filtered.map(row => (
              <tr key={row.id} className="border-b hover:bg-surface2 transition-colors" style={{ borderColor: "var(--border)" }}>
                <td className="px-[14px] py-[10px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: "var(--accent2)", color: "var(--accent)", fontFamily: "var(--font-head)" }}
                    >
                      {row.initials}
                    </span>
                    <span className="font-semibold text-[13px]">{row.full_name}</span>
                  </div>
                </td>
                <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">{row.email || "-"}</td>
                <td className="px-[14px] py-[10px]">
                  <UserRoleEditor
                    role={row.role}
                    disabled={busyId === row.id}
                    onChange={nextRole => saveRole(row, nextRole)}
                  />
                </td>
                <td className="px-[14px] py-[10px]">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-[14px] py-[10px]">
                  <div className="flex items-center gap-1">
                    <button
                      className="pc-btn-icon"
                      title={row.status === "disabled" ? "Riabilita utente" : "Disabilita utente"}
                      disabled={busyId === row.id || row.id === user?.id}
                      onClick={() => toggleDisabled(row)}
                    >
                      {row.status === "disabled" ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      className="pc-btn-icon"
                      title="Rimuovi utente"
                      disabled={busyId === row.id || row.id === user?.id}
                      onClick={() => remove(row)}
                      style={{ color: "var(--danger, #DC2626)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loadingRows && !filtered.length && (
              <tr><td colSpan={5} className="text-center py-10 text-text3 text-sm">Nessun utente trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRoleEditor({ role, disabled, onChange }: { role: AppRole; disabled: boolean; onChange: (role: AppRole) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <UserCog className="w-3.5 h-3.5 text-text3" />
      <select
        className="pc-input h-8 min-w-[145px] text-[12px]"
        value={role}
        disabled={disabled}
        onChange={event => onChange(event.target.value as AppRole)}
      >
        {ROLES.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminUserRow["status"] }) {
  const active = status === "active";
  return (
    <span
      className="pc-badge"
      style={{
        background: active ? "var(--success-bg)" : "var(--danger-bg)",
        color: active ? "var(--success)" : "var(--danger)",
      }}
    >
      {active ? "Attivo" : "Disabilitato"}
    </span>
  );
}

function roleLabel(role: AppRole) {
  if (role === "admin") return "Amministratore";
  if (role === "tech") return "Tecnico";
  return "Visualizzatore";
}
