import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { MailPlus, Search, Trash2, UserCog, UserX, UserCheck, Shield, Plus } from "lucide-react";
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
import { listOAuthClients, createOAuthClient, type OAuthClientInfo } from "@/lib/oauth-consent";
import { OAUTH_SCOPES, getScopeLabel, type OAuthScope } from "@/lib/oauth-scopes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const listClients = useServerFn(listOAuthClients);
  const createClient = useServerFn(createOAuthClient);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [clients, setClients] = useState<OAuthClientInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [createClientBusy, setCreateClientBusy] = useState(false);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("viewer");
  const [newClientName, setNewClientName] = useState("");
  const [newClientDescription, setNewClientDescription] = useState("");
  const [newClientRedirectUris, setNewClientRedirectUris] = useState("");
  const [newClientScopes, setNewClientScopes] = useState<OAuthScope[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

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

  async function loadClients() {
    if (!session?.access_token || !isAdmin) return;
    setLoadingClients(true);
    try {
      const data = await listClients({ data: { accessToken: session.access_token } });
      setClients(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare i client OAuth");
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, [session?.access_token, isAdmin]);
  useEffect(() => {
    load();
  }, [session?.access_token, isAdmin]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
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

  function remove(row: AdminUserRow) {
    setDeleteTarget(row);
  }

  async function confirmRemove() {
    if (!session?.access_token || !deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteUser({ data: { accessToken: session.access_token, userId: deleteTarget.id } });
      toast.success("Utente rimosso");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rimozione non riuscita");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
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

  async function createNewClient(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;
    setCreateClientBusy(true);
    try {
      const redirectUris = newClientRedirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);
      await createClient({
        data: {
          accessToken: session.access_token,
          name: newClientName,
          description: newClientDescription,
          redirectUris,
          scopesAllowed: newClientScopes,
        },
      });
      toast.success("Client OAuth creato");
      setNewClientName("");
      setNewClientDescription("");
      setNewClientRedirectUris("");
      setNewClientScopes([]);
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creazione client non riuscita");
    } finally {
      setCreateClientBusy(false);
    }
  }

  if (loading || !isAdmin) {
    return <div className="text-text3 text-sm">Verifica permessi...</div>;
  }

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="users">Utenti</TabsTrigger>
        <TabsTrigger value="oauth">OAuth / Applicazioni</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-5">
        <form className="pc-card p-4 flex flex-wrap items-end gap-3" onSubmit={invite}>
          <div className="flex-1 min-w-[220px]">
            <label className="pc-label">Email nuovo utente</label>
            <input
              className="pc-input"
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="utente@azienda.it"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="pc-label">Nome</label>
            <input
              className="pc-input"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder="Mario Rossi"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="pc-label">Ruolo</label>
            <select
              className="pc-input"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as AppRole)}
            >
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
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
              onChange={(event) => setQ(event.target.value)}
              placeholder="Cerca nome o email..."
              className="bg-transparent outline-none text-[13px] flex-1"
            />
          </div>
          <select
            className="pc-input max-w-[180px]"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">Tutti i ruoli</option>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel(item)}
              </option>
            ))}
          </select>
          <span className="ml-auto self-center text-xs text-text3 font-mono">
            {filtered.length} utenti
          </span>
        </div>

        <div className="pc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Nome", "Email", "Ruolo", "Stato", "Azioni"].map((header) => (
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
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text3 text-sm">
                    Caricamento utenti...
                  </td>
                </tr>
              )}
              {!loadingRows &&
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-[14px] py-[10px]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            background: "var(--accent2)",
                            color: "var(--accent)",
                            fontFamily: "var(--font-head)",
                          }}
                        >
                          {row.initials}
                        </span>
                        <span className="font-semibold text-[13px]">{row.full_name}</span>
                      </div>
                    </td>
                    <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                      {row.email || "-"}
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <UserRoleEditor
                        role={row.role}
                        disabled={busyId === row.id}
                        onChange={(nextRole) => saveRole(row, nextRole)}
                      />
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <div className="flex items-center gap-1">
                        <button
                          className="pc-btn-icon"
                          title={
                            row.status === "disabled" ? "Riabilita utente" : "Disabilita utente"
                          }
                          disabled={busyId === row.id || row.id === user?.id}
                          onClick={() => toggleDisabled(row)}
                        >
                          {row.status === "disabled" ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
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
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text3 text-sm">
                    Nessun utente trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rimuovi utente</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare{" "}
                <strong>{deleteTarget?.email || deleteTarget?.full_name}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemove}>Conferma</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>

      <TabsContent value="oauth" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Nuovo Client OAuth
            </CardTitle>
            <CardDescription>
              Crea un nuovo client per integrare applicazioni esterne con PCReady
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNewClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Nome Applicazione</Label>
                  <Input
                    id="clientName"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="My App"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="clientDescription">Descrizione</Label>
                  <Input
                    id="clientDescription"
                    value={newClientDescription}
                    onChange={(e) => setNewClientDescription(e.target.value)}
                    placeholder="Breve descrizione dell'app"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="redirectUris">URL di Redirect</Label>
                <Textarea
                  id="redirectUris"
                  value={newClientRedirectUris}
                  onChange={(e) => setNewClientRedirectUris(e.target.value)}
                  placeholder="https://myapp.com/callback&#10;https://myapp.com/oauth/callback"
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Una URL per riga. Deve corrispondere esattamente nelle richieste OAuth.
                </p>
              </div>
              <div>
                <Label>Permessi Consentiti</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(OAUTH_SCOPES).map(([scope, def]) => (
                    <div key={scope} className="flex items-center space-x-2">
                      <Checkbox
                        id={scope}
                        checked={newClientScopes.includes(scope as OAuthScope)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewClientScopes([...newClientScopes, scope as OAuthScope]);
                          } else {
                            setNewClientScopes(newClientScopes.filter((s) => s !== scope));
                          }
                        }}
                      />
                      <Label htmlFor={scope} className="text-sm">
                        {def.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={createClientBusy}>
                <Plus className="w-4 h-4 mr-2" />
                {createClientBusy ? "Creazione..." : "Crea Client"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Registrati</CardTitle>
            <CardDescription>Applicazioni autorizzate ad accedere ai dati PCReady</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClients ? (
              <p className="text-center py-4 text-muted-foreground">Caricamento client...</p>
            ) : clients.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">Nessun client registrato</p>
            ) : (
              <div className="space-y-4">
                {clients.map((client) => (
                  <div key={client.clientId} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{client.name}</h4>
                        {client.description && (
                          <p className="text-sm text-muted-foreground mt-1">{client.description}</p>
                        )}
                        <p className="text-xs font-mono text-muted-foreground mt-2">
                          Client ID: {client.clientId}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Permessi:</p>
                      <div className="flex flex-wrap gap-1">
                        {client.scopesAllowed.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {getScopeLabel(scope)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function UserRoleEditor({
  role,
  disabled,
  onChange,
}: {
  role: AppRole;
  disabled: boolean;
  onChange: (role: AppRole) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <UserCog className="w-3.5 h-3.5 text-text3" />
      <select
        className="pc-input h-8 min-w-[145px] text-[12px]"
        value={role}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AppRole)}
      >
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {roleLabel(item)}
          </option>
        ))}
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
