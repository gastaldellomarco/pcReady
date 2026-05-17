import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { errorMessage, ListSkeleton, PageFetchError } from "@/components/page-states";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Copy,
  KeyRound,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  changePassword,
  getMyProfile,
  updateMyProfile,
  type UserProfile,
} from "@/lib/user-profile";
import { avatarColors, fmtDateTime } from "@/lib/pcready";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getBackupCodeStatus,
  logMfaAuditEvent,
  regenerateBackupCodes,
  type MfaBackupCodeStatus,
} from "@/lib/mfa";

type ProfileTab = "personal" | "security" | "notifications";

const TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];

const NOTIFICATION_FIELDS = [
  {
    key: "notify_ticket_assigned" as const,
    emailKey: "email_notify_ticket_assigned" as const,
    label: "Ticket assegnati",
  },
  {
    key: "notify_ticket_status_changed" as const,
    emailKey: "email_notify_ticket_status_changed" as const,
    label: "Cambio stato ticket",
  },
  {
    key: "notify_ticket_completed" as const,
    emailKey: "email_notify_ticket_completed" as const,
    label: "Ticket completati",
  },
  {
    key: "notify_automation_failed" as const,
    emailKey: "email_notify_automation_failed" as const,
    label: "Automazioni fallite",
  },
  {
    key: "notify_device_status_changed" as const,
    emailKey: "email_notify_device_status_changed" as const,
    label: "Cambio stato dispositivi",
  },
  {
    key: "notify_checklist_completed" as const,
    emailKey: "email_notify_checklist_completed" as const,
    label: "Checklist completate",
  },
  {
    key: "notify_mentions" as const,
    emailKey: "email_notify_mentions" as const,
    label: "Menzioni",
  },
] as const;

export const Route = createFileRoute("/_app/profile")({
  validateSearch: (search) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Profilo - PCReady" },
      { name: "description", content: "Profilo utente e preferenze personali." },
    ],
  }),
  component: ProfilePage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function ProfilePage() {
  const { session, user, profile: authProfile, refreshProfile } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const loadProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const savePassword = useServerFn(changePassword);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<ProfileTab>(searchToTab(search.tab));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileReloadToken, setProfileReloadToken] = useState(0);
  const [saving, setSaving] = useState<"personal" | "security" | "notifications" | "avatar" | null>(
    null,
  );
  const [personal, setPersonal] = useState({
    display_name: "",
    avatar_url: "",
    phone: "",
    timezone: "Europe/Rome",
    language: "it",
  });
  const [notifications, setNotifications] = useState({
    notify_ticket_assigned: true,
    notify_ticket_status_changed: true,
    notify_automation_failed: true,
    notify_device_status_changed: true,
    notify_checklist_completed: true,
    notify_mentions: true,
    notify_ticket_completed: true,
    email_notify_ticket_assigned: true,
    email_notify_ticket_status_changed: true,
    email_notify_ticket_completed: true,
    email_notify_automation_failed: true,
    email_notify_device_status_changed: true,
    email_notify_checklist_completed: true,
    email_notify_mentions: true,
    notification_digest: "immediate",
    webhook_url: "",
  });
  const [password, setPassword] = useState({ next: "", confirm: "" });
  const loadBackupStatus = useServerFn(getBackupCodeStatus);
  const createBackupCodes = useServerFn(regenerateBackupCodes);
  const logMfaEvent = useServerFn(logMfaAuditEvent);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState<MfaBackupCodeStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3 | 4>(1);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
    challengeId?: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableRequiresCode, setDisableRequiresCode] = useState(true);
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    setTab(searchToTab(search.tab));
  }, [search.tab]);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    setLoadError(null);
    loadProfile({ data: { accessToken: session.access_token } })
      .then((data) => {
        setProfile(data);
        setPersonal({
          display_name: data.display_name || "",
          avatar_url: data.avatar_url || "",
          phone: data.phone || "",
          timezone: data.timezone || "Europe/Rome",
          language: data.language || "it",
        });
        setNotifications({
          notify_ticket_assigned: data.notify_ticket_assigned,
          notify_ticket_status_changed: data.notify_ticket_status_changed,
          notify_automation_failed: data.notify_automation_failed,
          notify_device_status_changed: data.notify_device_status_changed,
          notify_checklist_completed: data.notify_checklist_completed,
          notify_mentions: data.notify_mentions,
          notify_ticket_completed: data.notify_ticket_completed,
          email_notify_ticket_assigned: data.email_notify_ticket_assigned,
          email_notify_ticket_status_changed: data.email_notify_ticket_status_changed,
          email_notify_ticket_completed: data.email_notify_ticket_completed,
          email_notify_automation_failed: data.email_notify_automation_failed,
          email_notify_device_status_changed: data.email_notify_device_status_changed,
          email_notify_checklist_completed: data.email_notify_checklist_completed,
          email_notify_mentions: data.email_notify_mentions,
          notification_digest: data.notification_digest,
          webhook_url: data.webhook_url || "",
        });
      })
      .catch((error) => setLoadError(errorMessage(error, "Impossibile caricare il profilo")))
      .finally(() => setLoading(false));
  }, [session?.access_token, loadProfile, profileReloadToken]);

  const initials = useMemo(() => {
    const name = personal.display_name || authProfile?.full_name || profile?.email || "U";
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || name.slice(0, 2).toUpperCase()
    );
  }, [authProfile?.full_name, personal.display_name, profile?.email]);
  const colors = avatarColors(initials);

  function setRouteTab(next: ProfileTab) {
    setTab(next);
    navigate({
      to: "/profile",
      search: () => ({ tab: next === "personal" ? undefined : next }) as any,
      replace: true,
    });
  }

  async function submitPersonal() {
    if (!session?.access_token) return;
    setSaving("personal");
    try {
      await saveProfile({
        data: {
          accessToken: session.access_token,
          profile: {
            display_name: personal.display_name,
            avatar_url: personal.avatar_url || null,
            phone: personal.phone || null,
            timezone: personal.timezone,
            language: personal.language as "it" | "en",
          },
        },
      });
      await refreshProfile();
      toast.success("Profilo aggiornato");
    } catch (error) {
      toast.error(errorMessage(error, "Salvataggio non riuscito"));
    } finally {
      setSaving(null);
    }
  }

  async function uploadAvatar(file: File | null) {
    if (!file || !session?.access_token || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un'immagine valida");
      return;
    }
    setSaving("avatar");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = data.publicUrl;
      setPersonal((current) => ({ ...current, avatar_url: avatarUrl }));
      await saveProfile({
        data: {
          accessToken: session.access_token,
          profile: { avatar_url: avatarUrl },
        },
      });
      await refreshProfile();
      toast.success("Avatar aggiornato");
    } catch (error) {
      toast.error(errorMessage(error, "Upload avatar non riuscito"));
    } finally {
      setSaving(null);
    }
  }

  const verifiedMfaFactor = useMemo(
    () => mfaFactors.find((factor) => factor.status === "verified") ?? null,
    [mfaFactors],
  );
  const mfaEnabled = !!verifiedMfaFactor;

  useEffect(() => {
    if (tab !== "security" || !session?.access_token) return;
    void refreshMfaStatus();
  }, [tab, session?.access_token]);

  async function refreshMfaStatus() {
    if (!session?.access_token) return;
    setMfaLoading(true);
    try {
      const [{ data, error }, status] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        loadBackupStatus({ data: { accessToken: session.access_token } }),
      ]);
      if (error) throw error;
      setMfaFactors((data?.totp ?? []) as any[]);
      setBackupStatus(status);
    } catch (error) {
      toast.error(errorMessage(error, "Impossibile caricare lo stato 2FA"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function startMfaSetup() {
    setMfaLoading(true);
    setSetupStep(1);
    setMfaCode("");
    setBackupCodes([]);
    setShowBackupCodes(false);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "PCReady",
      });
      if (error) throw error;
      const factorId = data.id;
      const qrCode = data.totp?.qr_code ?? "";
      const secret = data.totp?.secret ?? "";
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      setEnrollment({ factorId, qrCode, secret, challengeId: challengeData.id });
      setSetupOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, "Avvio configurazione 2FA non riuscito"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function verifyMfaSetup() {
    if (!session?.access_token || !enrollment?.challengeId || mfaCode.length !== 6) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: enrollment.challengeId,
        code: mfaCode,
      });
      if (error) throw error;
      const result = await createBackupCodes({ data: { accessToken: session.access_token } });
      setBackupCodes(result.codes);
      await logMfaEvent({
        data: {
          accessToken: session.access_token,
          actionType: "mfa_enabled",
          message: "Autenticazione a due fattori attivata",
        },
      });
      setSetupStep(3);
      await refreshMfaStatus();
      toast.success("2FA verificato");
    } catch (error) {
      toast.error(errorMessage(error, "Codice 2FA non valido"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function openDisableMfaDialog() {
    if (!verifiedMfaFactor) return;
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      setDisableRequiresCode(data.currentLevel !== "aal2");
      setDisableCode("");
      setDisableDialogOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, "Impossibile preparare la disattivazione 2FA"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function confirmDisableMfa() {
    if (!session?.access_token || !verifiedMfaFactor) return;
    const normalizedCode = disableCode.replace(/\D/g, "").slice(0, 6);
    if (disableRequiresCode && normalizedCode.length !== 6) {
      toast.error("Inserisci il codice 2FA a 6 cifre");
      return;
    }

    setMfaLoading(true);
    try {
      if (disableRequiresCode) {
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedMfaFactor.id,
        });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: verifiedMfaFactor.id,
          challengeId: challengeData.id,
          code: normalizedCode,
        });
        if (verifyError) throw verifyError;
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedMfaFactor.id });
      if (error) throw error;
      await logMfaEvent({
        data: {
          accessToken: session.access_token,
          actionType: "mfa_disabled",
          message: "Autenticazione a due fattori disattivata",
        },
      });
      setShowBackupCodes(false);
      setDisableDialogOpen(false);
      setDisableCode("");
      await refreshMfaStatus();
      toast.success("2FA disattivato");
    } catch (error) {
      toast.error(errorMessage(error, "Disattivazione 2FA non riuscita"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function regenerateCodes() {
    if (!session?.access_token) return;
    setMfaLoading(true);
    try {
      const result = await createBackupCodes({ data: { accessToken: session.access_token } });
      setBackupCodes(result.codes);
      setShowBackupCodes(true);
      await refreshMfaStatus();
      toast.success("Nuovi codici generati");
    } catch (error) {
      toast.error(errorMessage(error, "Rigenerazione codici non riuscita"));
    } finally {
      setMfaLoading(false);
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes.length) return;
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Codici copiati negli appunti");
  }

  async function submitPassword() {
    if (!session?.access_token) return;
    if (password.next !== password.confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    setSaving("security");
    try {
      await savePassword({ data: { accessToken: session.access_token, password: password.next } });
      setPassword({ next: "", confirm: "" });
      toast.success("Password aggiornata");
    } catch (error) {
      toast.error(errorMessage(error, "Cambio password non riuscito"));
    } finally {
      setSaving(null);
    }
  }

  async function submitNotifications() {
    if (!session?.access_token) return;
    setSaving("notifications");
    try {
      await saveProfile({
        data: {
          accessToken: session.access_token,
          profile: notifications as any,
        },
      });
      toast.success("Preferenze notifiche salvate");
    } catch (error) {
      toast.error(errorMessage(error, "Salvataggio notifiche non riuscito"));
    } finally {
      setSaving(null);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <PageFetchError message={loadError} onRetry={() => setProfileReloadToken((n) => n + 1)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="h-10 max-w-full rounded-md bg-muted animate-pulse sm:w-80" />
        <ListSkeleton rows={4} variant="app" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <PageFetchError
          message="Profilo non disponibile."
          onRetry={() => setProfileReloadToken((n) => n + 1)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Tabs value={tab} onValueChange={(value) => setRouteTab(value as ProfileTab)}>
        <TabsList className="grid w-full grid-cols-3 md:w-[520px]">
          <TabsTrigger value="personal">Dati personali</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
          <TabsTrigger value="notifications">Notifiche</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                Dati personali
              </CardTitle>
              <CardDescription>Gestisci identita, contatti e localizzazione.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-bold"
                  style={{ background: colors.bg, color: colors.fg }}
                >
                  {personal.avatar_url ? (
                    <img src={personal.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <Label htmlFor="avatar" className="pc-btn pc-btn-ghost pc-btn-sm cursor-pointer">
                    <Camera className="h-3.5 w-3.5" />
                    {saving === "avatar" ? "Upload..." : "Carica avatar"}
                  </Label>
                  <input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={saving === "avatar"}
                    onChange={(event) => uploadAvatar(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome visualizzato">
                  <Input
                    value={personal.display_name}
                    onChange={(event) =>
                      setPersonal((current) => ({ ...current, display_name: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Email">
                  <Input value={profile.email} readOnly className="text-muted-foreground" />
                </Field>
                <Field label="Telefono">
                  <Input
                    value={personal.phone}
                    onChange={(event) =>
                      setPersonal((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="+39 ..."
                  />
                </Field>
                <Field label="Timezone">
                  <Select
                    value={personal.timezone}
                    onValueChange={(value) =>
                      setPersonal((current) => ({ ...current, timezone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Lingua">
                  <Select
                    value={personal.language}
                    onValueChange={(value) =>
                      setPersonal((current) => ({ ...current, language: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Button onClick={submitPersonal} disabled={saving === "personal"}>
                <Save className="mr-2 h-4 w-4" />
                {saving === "personal" ? "Salvataggio..." : "Salva"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attivita recenti</CardTitle>
              <CardDescription>Ultime azioni registrate a tuo nome.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(profile.recent_activity ?? []).map((activity) => (
                  <div key={activity.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="text-sm">{activity.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {fmtDateTime(activity.created_at)}
                    </div>
                  </div>
                ))}
                {!(profile.recent_activity ?? []).length && (
                  <div className="text-sm text-muted-foreground">Nessuna attivita recente.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Sicurezza
                </CardTitle>
                <CardDescription>
                  Ultimo accesso:{" "}
                  {profile.last_sign_in_at ? fmtDateTime(profile.last_sign_in_at) : "-"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Nuova password">
                  <Input
                    type="password"
                    value={password.next}
                    onChange={(event) =>
                      setPassword((current) => ({ ...current, next: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Conferma password">
                  <Input
                    type="password"
                    value={password.confirm}
                    onChange={(event) =>
                      setPassword((current) => ({ ...current, confirm: event.target.value }))
                    }
                  />
                </Field>
                <Button
                  onClick={submitPassword}
                  disabled={saving === "security" || password.next.length < 8 || !password.confirm}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {saving === "security" ? "Salvataggio..." : "Aggiorna password"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {mfaEnabled ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Shield className="h-5 w-5" />
                  )}
                  Autenticazione a due fattori
                </CardTitle>
                <CardDescription>
                  Aggiungi un secondo livello di sicurezza al tuo account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mfaEnabled ? (
                  <>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> 2FA attivo
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Ultimo utilizzo:{" "}
                            {backupStatus?.last_used_at
                              ? fmtDateTime(backupStatus.last_used_at)
                              : "non disponibile"}
                          </p>
                        </div>
                        <Badge className="bg-emerald-600">Attivo</Badge>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Codici di backup</p>
                          <p className="text-xs text-muted-foreground">
                            {backupStatus ? `${backupStatus.remaining}/${backupStatus.total}` : "-"}{" "}
                            codici rimanenti
                          </p>
                        </div>
                        {backupStatus && backupStatus.remaining < 3 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Pochi codici
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBackupCodes((v) => !v)}
                        >
                          Visualizza codici backup
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={regenerateCodes}
                          disabled={mfaLoading}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Rigenera
                        </Button>
                      </div>
                      {showBackupCodes && backupCodes.length > 0 ? (
                        <BackupCodesPanel codes={backupCodes} onCopy={copyBackupCodes} />
                      ) : showBackupCodes ? (
                        <p className="text-xs text-muted-foreground">
                          Per motivi di sicurezza i codici esistenti non sono recuperabili.
                          Rigenerali per visualizzarne di nuovi.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="destructive"
                      onClick={openDisableMfaDialog}
                      disabled={mfaLoading}
                    >
                      Disattiva 2FA
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" /> 2FA non attivo
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Proteggi l&apos;accesso con Google Authenticator, Authy, 1Password o app
                      compatibili TOTP.
                    </p>
                    <Button onClick={startMfaSetup} disabled={mfaLoading}>
                      Attiva 2FA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Attiva autenticazione a due fattori</DialogTitle>
                <DialogDescription>Step {setupStep} di 4</DialogDescription>
              </DialogHeader>
              {setupStep === 1 && enrollment ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Scansiona il QR code con Google Authenticator, Authy, 1Password o app
                    compatibile.
                  </p>
                  <QrCodeBox qrCode={enrollment.qrCode} />
                  <div className="rounded-md bg-muted p-3 text-xs break-all">
                    Secret manuale: <span className="font-mono">{enrollment.secret}</span>
                  </div>
                </div>
              ) : null}
              {setupStep === 2 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Inserisci il codice a 6 cifre generato dall&apos;app per completare la verifica.
                  </p>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) =>
                      setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
              ) : null}
              {setupStep === 3 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Salva questi 8 codici di backup in un posto sicuro. Ogni codice e monouso e non
                    potra essere mostrato di nuovo.
                  </p>
                  <BackupCodesPanel codes={backupCodes} onCopy={copyBackupCodes} />
                </div>
              ) : null}
              {setupStep === 4 ? (
                <div className="rounded-lg border p-4 space-y-2 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" />
                  <p className="font-medium">2FA attivato correttamente</p>
                  <p className="text-sm text-muted-foreground">
                    Dal prossimo login ti verra richiesto un codice temporaneo.
                  </p>
                </div>
              ) : null}
              <DialogFooter>
                {setupStep === 1 ? (
                  <Button onClick={() => setSetupStep(2)}>Ho scansionato il QR code</Button>
                ) : null}
                {setupStep === 2 ? (
                  <Button onClick={verifyMfaSetup} disabled={mfaLoading || mfaCode.length !== 6}>
                    Verifica codice
                  </Button>
                ) : null}
                {setupStep === 3 ? (
                  <Button onClick={() => setSetupStep(4)}>Ho salvato i codici</Button>
                ) : null}
                {setupStep === 4 ? <Button onClick={() => setSetupOpen(false)}>Fine</Button> : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={disableDialogOpen}
            onOpenChange={(open) => {
              if (!mfaLoading) {
                setDisableDialogOpen(open);
                if (!open) setDisableCode("");
              }
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Disattiva autenticazione a due fattori</DialogTitle>
                <DialogDescription>
                  Questa operazione rimuove il secondo fattore dal tuo account. Potrai riattivarlo
                  in seguito.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div>
                      <p className="font-medium">Conferma richiesta</p>
                      <p className="text-muted-foreground">
                        Disattivando il 2FA, l&apos;accesso tornera a dipendere solo dalla password
                        e dai codici sessione.
                      </p>
                    </div>
                  </div>
                </div>

                {disableRequiresCode ? (
                  <div className="space-y-2">
                    <Label htmlFor="disable-mfa-code">Codice authenticator</Label>
                    <Input
                      id="disable-mfa-code"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={disableCode}
                      onChange={(event) =>
                        setDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && disableCode.length === 6) {
                          event.preventDefault();
                          void confirmDisableMfa();
                        }
                      }}
                      placeholder="123456"
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      disabled={mfaLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Supabase richiede una sessione AAL2 per rimuovere un fattore verificato:
                      inserisci il codice TOTP per confermare.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    La sessione corrente e gia verificata come AAL2, quindi non serve inserire un
                    altro codice.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDisableDialogOpen(false)}
                  disabled={mfaLoading}
                >
                  Annulla
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmDisableMfa}
                  disabled={mfaLoading || (disableRequiresCode && disableCode.length !== 6)}
                >
                  {mfaLoading ? "Disattivazione..." : "Disattiva 2FA"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Preferenze notifiche</CardTitle>
                <CardDescription>
                  Scegli per quali eventi ricevere notifiche e attraverso quali canali.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h4 className="text-sm font-medium mb-3">Eventi</h4>
                  <div className="rounded-md border">
                    <div
                      className="grid grid-cols-[1fr_80px_80px] gap-4 px-3 py-2 border-b text-xs font-medium text-text3 uppercase tracking-wider"
                      style={{ background: "var(--surface2)" }}
                    >
                      <span>Evento</span>
                      <span className="text-center">In-app</span>
                      <span className="text-center">Email</span>
                    </div>
                    {NOTIFICATION_FIELDS.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-[1fr_80px_80px] gap-4 items-center px-3 py-2.5 border-b last:border-0"
                      >
                        <Label htmlFor={field.key} className="text-sm cursor-pointer">
                          {field.label}
                        </Label>
                        <div className="flex justify-center">
                          <Switch
                            id={field.key}
                            checked={notifications[field.key]}
                            onCheckedChange={(checked) =>
                              setNotifications((current) => ({
                                ...current,
                                [field.key]: checked,
                              }))
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            id={field.emailKey}
                            checked={notifications[field.emailKey]}
                            onCheckedChange={(checked) =>
                              setNotifications((current) => ({
                                ...current,
                                [field.emailKey]: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Frequenza digest</h4>
                  <Select
                    value={notifications.notification_digest}
                    onValueChange={(value) =>
                      setNotifications((current) => ({
                        ...current,
                        notification_digest: value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediata</SelectItem>
                      <SelectItem value="15min">Ogni 15 minuti</SelectItem>
                      <SelectItem value="hourly">Ogni ora</SelectItem>
                      <SelectItem value="daily">Giornaliera</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text3 mt-1.5">
                    Raggruppa le notifiche e inviale secondo la frequenza scelta.
                  </p>
                </div>

                <Button onClick={submitNotifications} disabled={saving === "notifications"}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving === "notifications" ? "Salvataggio..." : "Salva preferenze"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Canali di notifica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-text3 uppercase tracking-wider">Email</Label>
                    <p className="text-sm mt-0.5">{profile.email}</p>
                    <p className="text-xs text-text3">Già configurata nel profilo.</p>
                  </div>
                  <div>
                    <Label
                      htmlFor="webhook_url"
                      className="text-xs text-text3 uppercase tracking-wider"
                    >
                      Webhook URL
                    </Label>
                    <Input
                      id="webhook_url"
                      value={notifications.webhook_url}
                      onChange={(event) =>
                        setNotifications((current) => ({
                          ...current,
                          webhook_url: event.target.value,
                        }))
                      }
                      placeholder="https://hooks.example.com/notify"
                      className="mt-1"
                    />
                    <p className="text-xs text-text3 mt-1">
                      Opzionale. Le notifiche verranno inviate anche via webhook.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-text3 uppercase tracking-wider">
                      Notifiche push (browser)
                    </Label>
                    <p className="text-sm mt-0.5 text-text2">
                      Supportate dal browser tramite notifiche in-app.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Ultimo invio</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.last_notification_sent_at ? (
                    <p className="text-sm">{fmtDateTime(profile.last_notification_sent_at)}</p>
                  ) : (
                    <p className="text-sm text-text3">Nessuna notifica inviata.</p>
                  )}
                  <p className="text-xs text-text3 mt-1">
                    Data e ora dell'ultima notifica inviata.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QrCodeBox({ qrCode }: { qrCode: string }) {
  if (!qrCode)
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        QR code non disponibile
      </div>
    );
  if (qrCode.trim().startsWith("<svg")) {
    return (
      <div
        className="mx-auto flex w-fit justify-center rounded-lg border bg-white p-4"
        dangerouslySetInnerHTML={{ __html: qrCode }}
      />
    );
  }
  return <img src={qrCode} alt="QR code 2FA" className="mx-auto rounded-lg border bg-white p-4" />;
}

function BackupCodesPanel({ codes, onCopy }: { codes: string[]; onCopy: () => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 font-mono text-sm">
        {codes.map((code) => (
          <div key={code} className="rounded bg-muted px-2 py-1 text-center">
            {code}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={onCopy}>
        <Copy className="mr-2 h-3.5 w-3.5" /> Copia codici
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className={cn("[&_input]:w-full")}>{children}</div>
    </div>
  );
}

function searchToTab(tab?: string): ProfileTab {
  if (tab === "security") return "security";
  if (tab === "notifications" || tab === "settings") return "notifications";
  return "personal";
}
