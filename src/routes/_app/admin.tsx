/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier, react-hooks/exhaustive-deps */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AppSettingsSchema,
  type AppSettingsInput,
  AdminUserInviteSchema,
  type AdminUserInviteInput,
  OAuthClientSchema,
  type OAuthClientInput,
} from "@/lib/schemas";
import { MailPlus, Search, Trash2, UserCog, UserX, UserCheck, Shield, Plus, Settings, FileText, Download } from "lucide-react";
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
import { getAppSettings, updateAppSettings, type AppSettings } from "@/lib/app-settings";
import { getAuditLog, exportAuditLog, type ActivityLogEntry, type AuditLogFilters } from "@/lib/audit-log";
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
  const loadSettings = useServerFn(getAppSettings);
  const saveSettings = useServerFn(updateAppSettings);
  const loadAuditLog = useServerFn(getAuditLog);
  const exportAudit = useServerFn(exportAuditLog);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [clients, setClients] = useState<OAuthClientInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [auditEntries, setAuditEntries] = useState<ActivityLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize] = useState(25);
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [createClientBusy, setCreateClientBusy] = useState(false);
  const [saveSettingsBusy, setSaveSettingsBusy] = useState(false);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const inviteForm = useForm<AdminUserInviteInput>({
    resolver: zodResolver(AdminUserInviteSchema),
    mode: "onChange",
    defaultValues: { email: "", fullName: "", role: "viewer" },
  });
  const oauthForm = useForm<any>({
    resolver: zodResolver(OAuthClientSchema),
    mode: "onChange",
    defaultValues: { name: "", description: null, redirectUrisRaw: "", scopesAllowed: [] },
  });
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

  async function loadAppSettings() {
    if (!session?.access_token || !isAdmin) return;
    setLoadingSettings(true);
    try {
      const data = await loadSettings({ data: { accessToken: session.access_token } });
      setSettings(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare le impostazioni");
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadAudit(page = 1, filters: AuditLogFilters = {}) {
    if (!session?.access_token || !isAdmin) return;
    setLoadingAudit(true);
    try {
      const data = await loadAuditLog({
        data: {
          accessToken: session.access_token,
          page,
          pageSize: auditPageSize,
          filters,
        },
      });
      setAuditEntries(data.entries);
      setAuditTotal(data.total);
      setAuditPage(page);
      setAuditFilters(filters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare il log di audit");
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, [session?.access_token, isAdmin]);
  useEffect(() => {
    loadAppSettings();
  }, [session?.access_token, isAdmin]);
  useEffect(() => {
    loadAudit();
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

 
  const createNewClient = oauthForm.handleSubmit(async (vals) => {
    if (!session?.access_token) return;
    setCreateClientBusy(true);
    try {
      // vals.redirectUrisRaw is transformed by Zod into string[] by the schema
      const redirectUris = vals.redirectUrisRaw as unknown as string[];
      await createOAuthClient({
        data: {
          accessToken: session.access_token,
          name: vals.name,
          description: (vals.description as string) ?? undefined,
          redirectUris,
          scopesAllowed: vals.scopesAllowed || [],
        },
      });
      toast.success("Client OAuth creato");
      oauthForm.reset();
      await loadClients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creazione client non riuscita");
    } finally {
      setCreateClientBusy(false);
    }
  });

  const settingsForm = useForm<any>({
    resolver: zodResolver(AppSettingsSchema),
    mode: "onChange",
    defaultValues: {
      organization_name: settings?.organization_name ?? "",
      default_timezone: settings?.default_timezone ?? "",
      max_devices_per_technician: settings?.max_devices_per_technician ?? 1,
      self_registration_enabled: settings?.self_registration_enabled ?? false,
      admin_approval_required: settings?.admin_approval_required ?? false,
      support_email: settings?.support_email ?? null,
    },
  });

  useEffect(() => {
    // reset form when settings load
    settingsForm.reset({
      organization_name: settings?.organization_name ?? "",
      default_timezone: settings?.default_timezone ?? "",
      max_devices_per_technician: settings?.max_devices_per_technician ?? 1,
      self_registration_enabled: settings?.self_registration_enabled ?? false,
      admin_approval_required: settings?.admin_approval_required ?? false,
      support_email: settings?.support_email ?? null,
    });
  }, [settings]);

  async function submitSettings(values: any) {
    if (!session?.access_token) return;
    setSaveSettingsBusy(true);
    try {
      const payload: AppSettings = {
        organization_name: values.organization_name,
        default_timezone: values.default_timezone,
        max_devices_per_technician: Number(values.max_devices_per_technician),
        self_registration_enabled: !!values.self_registration_enabled,
        admin_approval_required: !!values.admin_approval_required,
        support_email: (values.support_email as string) || "",
      };

      await saveSettings({ data: { accessToken: session.access_token, settings: payload } });
      setSettings(payload);
      toast.success("Impostazioni salvate");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito");
    } finally {
      setSaveSettingsBusy(false);
    }
  }

  async function handleExportAudit() {
    if (!session?.access_token) return;
    try {
      const data = await exportAudit({
        data: {
          accessToken: session.access_token,
          filters: auditFilters,
        },
      });

      // Create and download CSV file
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", data.filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("File CSV esportato");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Esportazione non riuscita");
    }
  }

  if (loading || !isAdmin) {
    return <div className="text-text3 text-sm">Verifica permessi...</div>;
  }

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">Utenti</TabsTrigger>
        <TabsTrigger value="settings">Impostazioni App</TabsTrigger>
        <TabsTrigger value="oauth">OAuth / Applicazioni</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-5">
        <form
          className="pc-card p-4 flex flex-wrap items-end gap-3"
          onSubmit={inviteForm.handleSubmit(async (vals) => {
            if (!session?.access_token) return;
            setInviteBusy(true);
            try {
              await inviteUser({
                data: {
                  accessToken: session.access_token,
                  email: vals.email,
                  fullName: vals.fullName,
                  role: vals.role,
                  redirectTo: `${window.location.origin}/auth`,
                },
              });
              toast.success("Invito inviato");
              inviteForm.reset();
              await load();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Invito non riuscito");
            } finally {
              setInviteBusy(false);
            }
          })}
        >
          <div className="flex-1 min-w-[220px]">
            <label className="pc-label">Email nuovo utente</label>
            <input
              className="pc-input"
              type="email"
              {...inviteForm.register("email")}
              placeholder="utente@azienda.it"
            />
            {inviteForm.formState.errors.email && (
              <p className="text-sm text-destructive mt-1">{String(inviteForm.formState.errors.email?.message)}</p>
            )}
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="pc-label">Nome</label>
            <input className="pc-input" {...inviteForm.register("fullName")} placeholder="Mario Rossi" />
            {inviteForm.formState.errors.fullName && (
              <p className="text-sm text-destructive mt-1">{String(inviteForm.formState.errors.fullName?.message)}</p>
            )}
          </div>
          <div className="min-w-[160px]">
            <label className="pc-label">Ruolo</label>
            <select className="pc-input" {...inviteForm.register("role")}>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <button className="pc-btn pc-btn-primary" disabled={inviteBusy || !inviteForm.formState.isValid} type="submit">
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
                  <Input id="clientName" {...oauthForm.register("name")} placeholder="My App" />
                  {oauthForm.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">{String(oauthForm.formState.errors.name?.message)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="clientDescription">Descrizione</Label>
                  <Input id="clientDescription" {...oauthForm.register("description")} placeholder="Breve descrizione dell'app" />
                </div>
              </div>
              <div>
                <Label htmlFor="redirectUris">URL di Redirect</Label>
                <Textarea id="redirectUris" {...oauthForm.register("redirectUrisRaw")} placeholder="https://myapp.com/callback&#10;https://myapp.com/oauth/callback" rows={3} />
                {oauthForm.formState.errors.redirectUrisRaw && (
                  <p className="text-sm text-destructive mt-1">{String(oauthForm.formState.errors.redirectUrisRaw?.message)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Una URL per riga. Deve corrispondere esattamente nelle richieste OAuth.</p>
              </div>
              <div>
                <Label>Permessi Consentiti</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(OAUTH_SCOPES).map(([scope, def]) => {
                    const checked: string[] = oauthForm.watch("scopesAllowed") || [];
                    return (
                      <div key={scope} className="flex items-center space-x-2">
                        <Checkbox
                          id={scope}
                          checked={checked.includes(scope)}
                          onCheckedChange={(val) => {
                            const current = oauthForm.getValues().scopesAllowed || [];
                            if (val) oauthForm.setValue("scopesAllowed", [...current, scope]);
                            else oauthForm.setValue("scopesAllowed", current.filter((s: string) => s !== scope));
                          }}
                        />
                        <Label htmlFor={scope} className="text-sm">{def.label}</Label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" disabled={createClientBusy || !oauthForm.formState.isValid}>
                <Plus className="w-4 h-4 mr-2" />{createClientBusy ? "Creazione..." : "Crea Client"}
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
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Per la gestione del consenso OAuth degli utenti, vedere{" "}
                <a
                  href="https://github.com/your-repo/issues/31"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  issue #31: Admin: Pagina OAuth Consent per autorizzazione membri
                </a>
              </p>
            </div>
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

      <TabsContent value="settings" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Impostazioni Applicazione
            </CardTitle>
            <CardDescription>
              Configura le impostazioni globali dell'applicazione PCReady
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSettings ? (
              <p className="text-center py-4 text-muted-foreground">Caricamento impostazioni...</p>
            ) : settings ? (
              <form onSubmit={settingsForm.handleSubmit(submitSettings)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="organization_name">Nome Organizzazione</Label>
                    <Input
                      id="organization_name"
                      {...settingsForm.register("organization_name")}
                      placeholder="PCReady"
                    />
                    {settingsForm.formState.errors.organization_name && (
                      <p className="text-sm text-destructive mt-1">
                        {String(settingsForm.formState.errors.organization_name?.message)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="default_timezone">Timezone Predefinito</Label>
                    <Input
                      id="default_timezone"
                      {...settingsForm.register("default_timezone")}
                      placeholder="Europe/Rome"
                    />
                    {settingsForm.formState.errors.default_timezone && (
                      <p className="text-sm text-destructive mt-1">
                        {String(settingsForm.formState.errors.default_timezone?.message)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_devices_per_technician">Max Dispositivi per Tecnico</Label>
                    <Input
                      id="max_devices_per_technician"
                      type="number"
                      min={1}
                      max={100}
                      {...settingsForm.register("max_devices_per_technician")}
                    />
                    {settingsForm.formState.errors.max_devices_per_technician && (
                      <p className="text-sm text-destructive mt-1">
                        {String(settingsForm.formState.errors.max_devices_per_technician?.message)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="support_email">Email Supporto</Label>
                    <Input id="support_email" type="email" {...settingsForm.register("support_email")} placeholder="support@pcready.it" />
                    {settingsForm.formState.errors.support_email && (
                      <p className="text-sm text-destructive mt-1">
                        {String(settingsForm.formState.errors.support_email?.message)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="self_registration_enabled" {...settingsForm.register("self_registration_enabled")} />
                    <Label htmlFor="self_registration_enabled">Abilita registrazione autonoma nuovi utenti</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="admin_approval_required" {...settingsForm.register("admin_approval_required")} />
                    <Label htmlFor="admin_approval_required">Richiedi approvazione admin per nuovi account</Label>
                  </div>
                </div>

                <Button type="submit" disabled={!settingsForm.formState.isValid || saveSettingsBusy}>
                  <Settings className="w-4 h-4 mr-2" />
                  {saveSettingsBusy ? "Salvataggio..." : "Salva Impostazioni"}
                </Button>
              </form>
            ) : (
              <p className="text-center py-4 text-muted-foreground">Errore nel caricamento delle impostazioni</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log di Audit
            </CardTitle>
            <CardDescription>
              Visualizza le azioni amministrative e di sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Filtra per utente..."
                  value={auditFilters.user || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, user: e.target.value })}
                  className="max-w-[200px]"
                />
                <select
                  className="pc-input max-w-[150px]"
                  value={auditFilters.actionType || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, actionType: e.target.value })}
                >
                  <option value="">Tutti i tipi</option>
                  <option value="sys">Sistema</option>
                  <option value="auto">Automatico</option>
                  <option value="user">Utente</option>
                </select>
                <Input
                  type="date"
                  value={auditFilters.dateFrom || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, dateFrom: e.target.value })}
                  className="max-w-[150px]"
                />
                <Input
                  type="date"
                  value={auditFilters.dateTo || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, dateTo: e.target.value })}
                  className="max-w-[150px]"
                />
                <Button onClick={() => loadAudit(1, auditFilters)} variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  Filtra
                </Button>
                <Button onClick={handleExportAudit} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Esporta CSV
                </Button>
              </div>

              {loadingAudit ? (
                <p className="text-center py-4 text-muted-foreground">Caricamento log...</p>
              ) : auditEntries.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Nessuna attività trovata</p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{entry.message}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{entry.actor_name}</span>
                            <span>{new Date(entry.created_at).toLocaleString("it-IT")}</span>
                            <Badge variant="outline">
                              {entry.type === "sys" ? "Sistema" : entry.type === "auto" ? "Automatico" : "Utente"}
                            </Badge>
                            {entry.ticket_id && <span>Ticket: {entry.ticket_id}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      Pagina {auditPage} di {Math.ceil(auditTotal / auditPageSize)} ({auditTotal} totale)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => loadAudit(auditPage - 1, auditFilters)}
                        disabled={auditPage <= 1}
                        variant="outline"
                        size="sm"
                      >
                        Precedente
                      </Button>
                      <Button
                        onClick={() => loadAudit(auditPage + 1, auditFilters)}
                        disabled={auditPage >= Math.ceil(auditTotal / auditPageSize)}
                        variant="outline"
                        size="sm"
                      >
                        Successivo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
