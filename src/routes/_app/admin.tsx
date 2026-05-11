import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  MailPlus,
  Search,
  Trash2,
  UserCog,
  UserX,
  UserCheck,
  Shield,
  Plus,
  Settings,
  FileText,
  Download,
  ChevronDown,
  BookOpen,
  Copy,
  DatabaseBackup,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth-context";
import {
  deleteAdminUser,
  inviteAdminUser,
  listAdminUsers,
  resendAdminUserInvite,
  setAdminUserDisabled,
  updateAdminUser,
  type AdminUserRow,
} from "@/lib/admin-users";
import {
  listOAuthClients,
  createOAuthClient,
  type OAuthClientCreated,
  type OAuthClientInfo,
} from "@/lib/oauth-consent";
import { OAUTH_SCOPES, getScopeLabel, type OAuthScope } from "@/lib/oauth-scopes";
import { getAppSettings, updateAppSettings, type AppSettings } from "@/lib/app-settings";
import { EmailTemplateSection } from "@/components/admin/EmailTemplateSection";
import {
  getAuditLog,
  exportAuditLog,
  type ActivityLogEntry,
  type AuditLogFilters,
} from "@/lib/audit-log";
import { exportAllData } from "@/lib/export-data";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
const WIP_LIMIT_FIELDS = [
  ["pending", "In attesa"],
  ["in-progress", "In lavorazione"],
  ["testing", "Testing"],
  ["ready", "Pronto"],
  ["completed", "Completato"],
  ["archived", "Archiviato"],
] as const;

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtElapsed(value: string | null) {
  if (!value) return "in attesa";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} g`;
}

function isAppRole(value: string): value is AppRole {
  return value === "admin" || value === "tech" || value === "viewer";
}

function TagListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = draft.trim();
    if (!next || values.some((value) => value.toLowerCase() === next.toLowerCase())) return;
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-2">
            {value}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              ×
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          onBlur={addValue}
          placeholder={placeholder}
          className="h-7 min-w-48 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

function AdminUsersPage() {
  function getErrorMessage(error: unknown, fallback: string) {
    try {
      if (!error) return fallback;
      if (error instanceof Error) return error.message;
      const anyErr = error as any;
      if (typeof anyErr === "string") return anyErr;
      if (anyErr?.message) return String(anyErr.message);
      if (anyErr?.status) return `${anyErr.status} ${anyErr?.statusText ?? ""}`.trim();
      return String(anyErr);
    } catch {
      return fallback;
    }
  }

  const { isAdmin, loading, session, user } = useAuth();
  const navigate = useNavigate();
  const listUsers = useServerFn(listAdminUsers);
  const updateUser = useServerFn(updateAdminUser);
  const setDisabled = useServerFn(setAdminUserDisabled);
  const deleteUser = useServerFn(deleteAdminUser);
  const inviteUser = useServerFn(inviteAdminUser);
  const resendInvite = useServerFn(resendAdminUserInvite);
  const listClients = useServerFn(listOAuthClients);
  const createClient = useServerFn(createOAuthClient);
  const loadSettings = useServerFn(getAppSettings);
  const saveSettings = useServerFn(updateAppSettings);
  const loadAuditLog = useServerFn(getAuditLog);
  const exportAudit = useServerFn(exportAuditLog);
  const exportData = useServerFn(exportAllData);
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
  const [exportAllBusy, setExportAllBusy] = useState(false);
  const [oauthCreated, setOauthCreated] = useState<
    (OAuthClientCreated & { exampleRedirectUri: string }) | null
  >(null);
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
  const oauthForm = useForm<OAuthClientInput>({
    resolver: zodResolver(OAuthClientSchema),
    mode: "onChange",
    defaultValues: { name: "", description: null, redirectUrisRaw: "", scopesAllowed: [] },
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  const load = useCallback(async () => {
    if (!session?.access_token || !isAdmin) return;
    setLoadingRows(true);
    try {
      const data = await listUsers({ data: { accessToken: session.access_token } });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossibile caricare gli utenti"));
    } finally {
      setLoadingRows(false);
    }
  }, [session?.access_token, isAdmin, listUsers]);

  const loadClients = useCallback(async () => {
    if (!session?.access_token || !isAdmin) return;
    setLoadingClients(true);
    try {
      const data = await listClients({ data: { accessToken: session.access_token } });
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossibile caricare i client OAuth"));
    } finally {
      setLoadingClients(false);
    }
  }, [session?.access_token, isAdmin, listClients]);

  const loadAppSettings = useCallback(async () => {
    if (!session?.access_token || !isAdmin) return;
    setLoadingSettings(true);
    try {
      const data = await loadSettings({ data: { accessToken: session.access_token } });
      setSettings(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Impossibile caricare le impostazioni"));
    } finally {
      setLoadingSettings(false);
    }
  }, [session?.access_token, isAdmin, loadSettings]);

  const loadAudit = useCallback(
    async (page = 1, filters: AuditLogFilters = {}) => {
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
        toast.error(getErrorMessage(error, "Impossibile caricare il log di audit"));
      } finally {
        setLoadingAudit(false);
      }
    },
    [session?.access_token, isAdmin, loadAuditLog, auditPageSize],
  );

  useEffect(() => {
    loadClients();
  }, [session?.access_token, isAdmin, loadClients]);
  useEffect(() => {
    loadAppSettings();
  }, [session?.access_token, isAdmin, loadAppSettings]);
  useEffect(() => {
    loadAudit();
  }, [session?.access_token, isAdmin, loadAudit]);
  useEffect(() => {
    load();
  }, [session?.access_token, isAdmin, load]);

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
      toast.error(getErrorMessage(error, "Aggiornamento non riuscito"));
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
      toast.error(getErrorMessage(error, "Operazione non riuscita"));
    } finally {
      setBusyId(null);
    }
  }

  async function resendInviteFor(row: AdminUserRow) {
    if (!session?.access_token || row.status !== "invited") return;
    setBusyId(row.id);
    try {
      await resendInvite({
        data: {
          accessToken: session.access_token,
          userId: row.id,
          redirectTo: `${window.location.origin}/auth/set-password`,
        },
      });
      toast.success("Invito re-inviato");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Re-invio invito non riuscito"));
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
      toast.error(getErrorMessage(error, "Rimozione non riuscita"));
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  const createNewClient = oauthForm.handleSubmit(async (vals) => {
    if (!session?.access_token) return;
    setCreateClientBusy(true);
    try {
      // parse textarea (one URL per line) into array
      const redirectUris = (vals.redirectUrisRaw as string)
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
      const created = await createClient({
        data: {
          accessToken: session.access_token,
          name: vals.name,
          description: (vals.description as string) ?? undefined,
          redirectUris,
          scopesAllowed: (vals.scopesAllowed || []) as OAuthScope[],
        },
      });
      toast.success("Client OAuth creato");
      setOauthCreated({
        ...created,
        exampleRedirectUri: redirectUris[0] ?? "",
      });
      oauthForm.reset();
      await loadClients();
    } catch (error) {
      toast.error(getErrorMessage(error, "Creazione client non riuscita"));
    } finally {
      setCreateClientBusy(false);
    }
  });

  async function copyOAuthField(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiato negli appunti`);
    } catch {
      toast.error("Impossibile copiare. Seleziona il testo manualmente.");
    }
  }

  const settingsForm = useForm<z.input<typeof AppSettingsSchema>>({
    resolver: zodResolver(AppSettingsSchema),
    mode: "onChange",
    defaultValues: {
      organization_name: settings?.organization_name ?? "",
      default_timezone: settings?.default_timezone ?? "",
      max_devices_per_technician: settings?.max_devices_per_technician ?? 1,
      self_registration_enabled: settings?.self_registration_enabled ?? false,
      admin_approval_required: settings?.admin_approval_required ?? false,
      support_email: settings?.support_email ?? null,
      wip_limits: settings?.wip_limits ?? {
        pending: 20,
        "in-progress": 5,
        testing: 5,
        ready: 20,
        completed: 0,
        archived: 0,
      },
      archive_after_days: settings?.archive_after_days ?? 7,
      os_options: settings?.os_options ?? [],
      device_brands: settings?.device_brands ?? [],
      ticket_categories: settings?.ticket_categories ?? [],
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
      wip_limits: settings?.wip_limits ?? {
        pending: 20,
        "in-progress": 5,
        testing: 5,
        ready: 20,
        completed: 0,
        archived: 0,
      },
      archive_after_days: settings?.archive_after_days ?? 7,
      os_options: settings?.os_options ?? [],
      device_brands: settings?.device_brands ?? [],
      ticket_categories: settings?.ticket_categories ?? [],
    });
  }, [settings, settingsForm]);

  async function submitSettings(values: z.input<typeof AppSettingsSchema>) {
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
        wip_limits: {
          pending: Number(values.wip_limits.pending),
          "in-progress": Number(values.wip_limits["in-progress"]),
          testing: Number(values.wip_limits.testing),
          ready: Number(values.wip_limits.ready),
          completed: Number(values.wip_limits.completed ?? 0),
          archived: Number(values.wip_limits.archived ?? 0),
        },
        archive_after_days: Number(values.archive_after_days ?? 7),
        os_options: values.os_options ?? [],
        device_brands: values.device_brands ?? [],
        ticket_categories: values.ticket_categories ?? [],
      };

      await saveSettings({ data: { accessToken: session.access_token, settings: payload } });
      setSettings(payload);
      toast.success("Impostazioni salvate");
    } catch (error) {
      toast.error(getErrorMessage(error, "Salvataggio non riuscito"));
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
      toast.error(getErrorMessage(error, "Esportazione non riuscita"));
    }
  }

  async function handleExportAllData() {
    if (!session?.access_token) return;
    setExportAllBusy(true);
    try {
      const data = await exportData({ data: { accessToken: session.access_token } });
      const files = Object.values(data.files);
      const zipBlob = createZipBlob(
        files.map((file) => ({
          name: file.filename,
          content: file.csv,
        })),
      );
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(zipBlob, `pcready_full_export_${date}.zip`);
      toast.success("Export completo generato");
    } catch (error) {
      toast.error(getErrorMessage(error, "Export dati non riuscito"));
    } finally {
      setExportAllBusy(false);
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
                  redirectTo: `${window.location.origin}/auth/set-password`,
                },
              });
              toast.success("Invito inviato");
              inviteForm.reset();
              await load();
            } catch (error) {
              toast.error(getErrorMessage(error, "Invito non riuscito"));
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
              <p className="text-sm text-destructive mt-1">
                {String(inviteForm.formState.errors.email?.message)}
              </p>
            )}
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="pc-label">Nome</label>
            <input
              className="pc-input"
              {...inviteForm.register("fullName")}
              placeholder="Mario Rossi"
            />
            {inviteForm.formState.errors.fullName && (
              <p className="text-sm text-destructive mt-1">
                {String(inviteForm.formState.errors.fullName?.message)}
              </p>
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
          <button
            className="pc-btn pc-btn-primary"
            disabled={inviteBusy || !inviteForm.formState.isValid}
            type="submit"
          >
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
            {(filtered ?? []).length} utenti
          </span>
        </div>

        <div className="pc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Nome", "Email", "Ruolo", "Creato il", "Accesso", "Stato", "Azioni"].map((header) => (
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
                  <td colSpan={7} className="text-center py-10 text-text3 text-sm">
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
                    <td className="px-[14px] py-[10px] text-[11.5px] text-text3 font-mono">
                      {fmtDateTime(row.created_at)}
                    </td>
                    <td className="px-[14px] py-[10px] text-[11.5px] text-text3 font-mono">
                      {row.last_sign_in_at ? (
                        fmtDateTime(row.last_sign_in_at)
                      ) : (
                        <span className="italic">Mai acceduto</span>
                      )}
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <StatusBadge
                        status={row.status}
                        invitedAt={row.invited_at}
                        busy={busyId === row.id}
                        onResend={() => resendInviteFor(row)}
                      />
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
              {!loadingRows && !(filtered ?? []).length && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text3 text-sm">
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
              Crea un nuovo client per integrare applicazioni esterne con PCReady in modo sicuro.
            </CardDescription>
            <p className="text-sm pt-2">
              <Link
                to="/docs"
                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Leggi la documentazione API (OpenAPI / OAuth)
              </Link>
            </p>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <Shield className="h-4 w-4" />
              <AlertTitle>Cos&apos;è un Client OAuth?</AlertTitle>
              <AlertDescription>
                Un Client OAuth permette a un&apos;applicazione esterna (per esempio un tool di
                automazione, un&apos;app mobile o un sistema ERP) di accedere ai dati di PCReady in
                modo sicuro, senza condividere le password degli utenti. Crea un client solo se
                stai collegando un&apos;applicazione esterna che deve operare per conto degli utenti
                che la autorizzano.
              </AlertDescription>
            </Alert>

            <Alert className="mb-4 border-muted bg-muted/40">
              <AlertTitle className="text-foreground">Flusso supportato</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                PCReady espone il flusso OAuth 2.0{" "}
                <strong className="text-foreground">Authorization Code</strong> (
                <code className="text-xs">response_type=code</code>). Gli integratori avviano
                l&apos;accesso reindirizzando l&apos;utente all&apos;endpoint di autorizzazione,
                poi scambiano il codice per un token. Il flusso{" "}
                <strong className="text-foreground">Client Credentials</strong> non è supportato
                per questi client.
              </AlertDescription>
            </Alert>

            <form onSubmit={createNewClient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Nome applicazione</Label>
                  <Input id="clientName" {...oauthForm.register("name")} placeholder="Es. CRM Aziendale" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nome visibile a chi autorizza l&apos;app e negli elenchi admin.
                  </p>
                  {oauthForm.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {String(oauthForm.formState.errors.name?.message)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="clientDescription">Descrizione (facoltativa)</Label>
                  <Input
                    id="clientDescription"
                    {...oauthForm.register("description")}
                    placeholder="A cosa serve questa integrazione"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Testo libero per ricordare a chi è destinata l&apos;integrazione.
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="redirectUris">URL di redirect (callback)</Label>
                <Textarea
                  id="redirectUris"
                  {...oauthForm.register("redirectUrisRaw")}
                  placeholder="https://myapp.com/callback&#10;https://myapp.com/oauth/callback"
                  rows={3}
                />
                {oauthForm.formState.errors.redirectUrisRaw && (
                  <p className="text-sm text-destructive mt-1">
                    {String(oauthForm.formState.errors.redirectUrisRaw?.message)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  L&apos;indirizzo a cui PCReady reindirizza il browser dopo che l&apos;utente ha
                  effettuato l&apos;accesso e concesso i permessi (redirect URI OAuth 2.0). Deve
                  coincidere <strong>esattamente</strong> con quanto configurato nell&apos;app esterna:
                  trovi il valore nella documentazione o nelle impostazioni sviluppatore di quell&apos;app.
                  Una URL per riga. Esempio:{" "}
                  <code className="text-[11px] rounded bg-muted px-1 py-0.5">
                    https://myapp.com/oauth/callback
                  </code>
                </p>
              </div>
              <div>
                <Label>Permessi consentiti (scope)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Seleziona cosa l&apos;applicazione potrà chiedere agli utenti durante
                  l&apos;autorizzazione. Ogni voce mostra il nome tecnico del permesso tra parentesi.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(OAUTH_SCOPES).map(([scope, def]) => {
                    const checked: string[] = oauthForm.watch("scopesAllowed") || [];
                    return (
                      <div
                        key={scope}
                        className="flex gap-3 rounded-lg border border-border p-3 bg-background"
                      >
                        <Checkbox
                          id={scope}
                          className="mt-0.5"
                          checked={checked.includes(scope)}
                          onCheckedChange={(val) => {
                            const current = oauthForm.getValues().scopesAllowed || [];
                            if (val) oauthForm.setValue("scopesAllowed", [...current, scope]);
                            else
                              oauthForm.setValue(
                                "scopesAllowed",
                                current.filter((s: string) => s !== scope),
                              );
                          }}
                        />
                        <div className="min-w-0 space-y-1">
                          <Label htmlFor={scope} className="text-sm font-medium cursor-pointer">
                            {def.label}
                          </Label>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {def.longDescription}
                          </p>
                          <code className="text-[10px] text-muted-foreground">{scope}</code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" disabled={createClientBusy || !oauthForm.formState.isValid}>
                <Plus className="w-4 h-4 mr-2" />
                {createClientBusy ? "Creazione..." : "Crea client"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Dialog
          open={!!oauthCreated}
          onOpenChange={(open) => {
            if (!open) setOauthCreated(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {oauthCreated ? (
              <>
                <DialogHeader>
                  <DialogTitle>Client creato</DialogTitle>
                  <DialogDescription>
                    {oauthCreated.name}: usa questi valori nella tua applicazione. Il secret non
                    sarà più mostrato.
                  </DialogDescription>
                </DialogHeader>

                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Salva subito il Client Secret</AlertTitle>
                  <AlertDescription>
                    Il Client Secret è mostrato <strong>una sola volta</strong> e non sarà
                    recuperabile da PCReady dopo aver chiuso questa finestra. Copialo e conservalo in
                    un gestore segreti o in configurazione sicura prima di proseguire.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-muted-foreground">Client ID</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8"
                        onClick={() => copyOAuthField("Client ID", oauthCreated.clientId)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copia
                      </Button>
                    </div>
                    <pre className="mt-1 p-2 rounded-md bg-muted text-xs font-mono break-all whitespace-pre-wrap">
                      {oauthCreated.clientId}
                    </pre>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-muted-foreground">Client Secret</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8"
                        onClick={() => copyOAuthField("Client Secret", oauthCreated.clientSecret)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copia
                      </Button>
                    </div>
                    <pre className="mt-1 p-2 rounded-md bg-muted text-xs font-mono break-all whitespace-pre-wrap">
                      {oauthCreated.clientSecret}
                    </pre>
                  </div>
                </div>

                <Collapsible className="rounded-lg border px-3 py-2">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm font-medium hover:underline [&[data-state=open]>svg]:rotate-180">
                    Come usare questo client (Authorization Code)
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pb-3 text-xs text-muted-foreground">
                    <p>
                      1. Reindirizza l&apos;utente (già autenticato su PCReady) verso
                      l&apos;autorizzazione con i parametri in query. Sostituisci{" "}
                      <code className="rounded bg-muted px-1">redirect_uri</code>,{" "}
                      <code className="rounded bg-muted px-1">scope</code> e{" "}
                      <code className="rounded bg-muted px-1">state</code> con i valori della tua
                      app.
                    </p>
                    <div>
                      <span className="font-medium text-foreground">GET — autorizzazione</span>
                      <pre className="mt-1 p-2 rounded-md bg-muted font-mono text-[11px] break-all whitespace-pre-wrap">
                        {`${typeof window !== "undefined" ? window.location.origin : ""}/oauth/authorize?client_id=${encodeURIComponent(oauthCreated.clientId)}&redirect_uri=${encodeURIComponent(oauthCreated.exampleRedirectUri || "https://esempio.app/oauth/callback")}&response_type=code&scope=${encodeURIComponent(oauthCreated.scopesAllowed.length ? oauthCreated.scopesAllowed.join(" ") : "openid profile email")}&state=STATO_OPZIONALE`}
                      </pre>
                    </div>
                    <p>
                      Dopo il consenso, l&apos;utente torna al <code className="rounded bg-muted px-1">redirect_uri</code> con un <code className="rounded bg-muted px-1">code</code> temporaneo.
                    </p>
                    <div>
                      <span className="font-medium text-foreground">
                        POST — scambio code → token
                      </span>
                      <pre className="mt-1 p-2 rounded-md bg-muted font-mono text-[11px] break-all whitespace-pre-wrap">
                        {`${typeof window !== "undefined" ? window.location.origin : ""}/oauth/token`}
                      </pre>
                      <p className="mt-1">
                        Corpo tipico: <code className="rounded bg-muted px-1">grant_type=authorization_code</code>,{" "}
                        <code className="rounded bg-muted px-1">code</code>,{" "}
                        <code className="rounded bg-muted px-1">client_id</code>,{" "}
                        <code className="rounded bg-muted px-1">client_secret</code>,{" "}
                        <code className="rounded bg-muted px-1">redirect_uri</code> (come sopra). Dettagli e schema nella{" "}
                        <Link to="/docs" className="text-primary underline-offset-2 hover:underline">
                          documentazione API
                        </Link>
                        .
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <DialogFooter>
                  <Button type="button" onClick={() => setOauthCreated(null)}>
                    Ho salvato il secret, chiudi
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

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
            ) : (clients ?? []).length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">Nessun client registrato</p>
            ) : (
              <div className="space-y-4">
                {(Array.isArray(clients) ? clients : []).map((client) => (
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
                        {(client.scopesAllowed ?? []).map((scope) => (
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
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">Generale</TabsTrigger>
            <TabsTrigger value="email-templates">Template Email</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="mb-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DatabaseBackup className="h-5 w-5" />
                  Backup &amp; Disaster Recovery
                </CardTitle>
                <CardDescription>
                  Policy di protezione dati, continuità operativa ed export manuale.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <BackupMetric label="Frequenza" value="Giornaliero automatico" detail="Backup gestiti da Supabase" />
                  <BackupMetric label="Retention" value="30 giorni Pro / 7 giorni Free" detail="In base al piano Supabase" />
                  <BackupMetric label="Ultimo backup" value="Gestito dal provider" detail="Verificabile dalla dashboard Supabase" />
                  <BackupMetric label="RPO" value="< 24 ore" detail="Per backup automatici giornalieri" />
                  <BackupMetric label="RTO" value="< 4 ore" detail="Ripristino coordinato con il supporto" />
                  <BackupMetric
                    label="Emergenze"
                    value={settings?.support_email || "Email supporto non configurata"}
                    detail="Contatto operativo per restore e incidenti"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Export manuale dati</p>
                    <p className="text-xs text-muted-foreground">
                      Scarica un archivio ZIP con CSV di ticket, dispositivi e clienti.
                    </p>
                  </div>
                  <Button onClick={handleExportAllData} disabled={exportAllBusy} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    {exportAllBusy ? "Esportazione..." : "Esporta tutti i dati"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Dati protetti con backup giornalieri automatici</span>
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-center py-4 text-muted-foreground">
                    Caricamento impostazioni...
                  </p>
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
                        <Label htmlFor="max_devices_per_technician">
                          Max Dispositivi per Tecnico
                        </Label>
                        <Input
                          id="max_devices_per_technician"
                          type="number"
                          min={1}
                          max={100}
                          {...settingsForm.register("max_devices_per_technician")}
                        />
                        {settingsForm.formState.errors.max_devices_per_technician && (
                          <p className="text-sm text-destructive mt-1">
                            {String(
                              settingsForm.formState.errors.max_devices_per_technician?.message,
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="support_email">Email Supporto</Label>
                        <Input
                          id="support_email"
                          type="email"
                          {...settingsForm.register("support_email")}
                          placeholder="support@pcready.it"
                        />
                        {settingsForm.formState.errors.support_email && (
                          <p className="text-sm text-destructive mt-1">
                            {String(settingsForm.formState.errors.support_email?.message)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3 rounded-lg border p-4">
                        <div>
                          <h3 className="font-medium">Variabili di sistema</h3>
                          <p className="text-sm text-muted-foreground">
                            Gestisci le liste usate nei form operativi dell'applicazione.
                          </p>
                        </div>
                        <TagListEditor
                          label="Sistemi Operativi disponibili"
                          values={settingsForm.watch("os_options") ?? []}
                          onChange={(values) =>
                            settingsForm.setValue("os_options", values, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          placeholder="Aggiungi sistema operativo..."
                        />
                        <TagListEditor
                          label="Brand dispositivi"
                          values={settingsForm.watch("device_brands") ?? []}
                          onChange={(values) =>
                            settingsForm.setValue("device_brands", values, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          placeholder="Aggiungi brand..."
                        />
                        <TagListEditor
                          label="Categorie ticket"
                          values={settingsForm.watch("ticket_categories") ?? []}
                          onChange={(values) =>
                            settingsForm.setValue("ticket_categories", values, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          placeholder="Aggiungi categoria..."
                        />
                      </div>

                      <div>
                        <Label>Limiti WIP Kanban</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                          {WIP_LIMIT_FIELDS.map(([status, label]) => (
                            <div key={status}>
                              <Label
                                htmlFor={`wip_${status}`}
                                className="text-xs text-muted-foreground"
                              >
                                {label}
                              </Label>
                              <Input
                                id={`wip_${status}`}
                                type="number"
                                min={0}
                                max={999}
                                {...settingsForm.register(`wip_limits.${status}`)}
                              />
                              {settingsForm.formState.errors.wip_limits?.[status] && (
                                <p className="text-sm text-destructive mt-1">
                                  {String(
                                    settingsForm.formState.errors.wip_limits?.[status]?.message,
                                  )}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                          <div className="mt-3">
                            <Label htmlFor="archive_after_days">Archiviazione automatica (giorni)</Label>
                            <Input
                              id="archive_after_days"
                              type="number"
                              min={0}
                              max={365}
                              {...settingsForm.register("archive_after_days")}
                            />
                            {settingsForm.formState.errors.archive_after_days && (
                              <p className="text-sm text-destructive mt-1">
                                {String(settingsForm.formState.errors.archive_after_days?.message)}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">Numero di giorni dopo il completamento per spostare il ticket in archivio. 0 = mai.</p>
                          </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="self_registration_enabled"
                          {...settingsForm.register("self_registration_enabled")}
                        />
                        <Label htmlFor="self_registration_enabled">
                          Abilita registrazione autonoma nuovi utenti
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="admin_approval_required"
                          {...settingsForm.register("admin_approval_required")}
                        />
                        <Label htmlFor="admin_approval_required">
                          Richiedi approvazione admin per nuovi account
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={!settingsForm.formState.isValid || saveSettingsBusy}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {saveSettingsBusy ? "Salvataggio..." : "Salva Impostazioni"}
                    </Button>
                  </form>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">
                    Errore nel caricamento delle impostazioni
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email-templates">
            {session?.access_token ? (
              <EmailTemplateSection
                accessToken={session.access_token}
                adminEmail={user?.email ?? ""}
                organizationName={settings?.organization_name ?? "PCReady"}
                supportEmail={settings?.support_email ?? ""}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="audit" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log di Audit
            </CardTitle>
            <CardDescription>Visualizza le azioni amministrative e di sistema</CardDescription>
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
              ) : (auditEntries ?? []).length === 0 ? (
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
                              {entry.type === "sys"
                                ? "Sistema"
                                : entry.type === "auto"
                                  ? "Automatico"
                                  : "Utente"}
                            </Badge>
                            {entry.ticket_id && <span>Ticket: {entry.ticket_id}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      Pagina {auditPage} di {Math.ceil(auditTotal / auditPageSize)} ({auditTotal}{" "}
                      totale)
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
        className="pc-input h-8 w-[180px] text-[12px]"
        value={role}
        disabled={disabled}
        onChange={(event) => {
          if (isAppRole(event.target.value)) onChange(event.target.value);
        }}
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

function BackupMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function StatusBadge({
  status,
  invitedAt,
  busy,
  onResend,
}: {
  status: AdminUserRow["status"];
  invitedAt?: string | null;
  busy?: boolean;
  onResend?: () => void;
}) {
  if (status === "invited") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className="pc-badge"
          style={{
            background: "var(--warning-bg, #FEF3C7)",
            color: "var(--warning, #D97706)",
          }}
        >
          Invitato da {fmtElapsed(invitedAt ?? null)}
        </span>
        {onResend && (
          <button
            type="button"
            className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={onResend}
          >
            Re-invia invito
          </button>
        )}
      </div>
    );
  }

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createZipBlob(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    parts.push(localHeader, content);

    centralDirectory.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += localHeader.length + content.length;
  });

  const centralOffset = offset;
  const central = concatBytes(centralDirectory);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(centralOffset),
    u16(0),
  ]);

  const zipBytes = concatBytes([...parts, central, end]);
  return new Blob([zipBytes.buffer.slice(0)], { type: "application/zip" });
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
