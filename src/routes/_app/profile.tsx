import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Camera, KeyRound, Save, Shield, UserRound } from "lucide-react";
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
  ["notify_ticket_assigned", "Ticket assegnati"],
  ["notify_ticket_status_changed", "Cambio stato ticket"],
  ["notify_automation_failed", "Automazioni fallite"],
  ["notify_device_status_changed", "Cambio stato dispositivi"],
  ["notify_checklist_completed", "Checklist completate"],
  ["notify_mentions", "Menzioni"],
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
  });
  const [password, setPassword] = useState({ next: "", confirm: "" });

  useEffect(() => {
    setTab(searchToTab(search.tab));
  }, [search.tab]);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
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
        });
      })
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare il profilo")))
      .finally(() => setLoading(false));
  }, [session?.access_token, loadProfile]);

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
          profile: notifications,
        },
      });
      toast.success("Preferenze notifiche salvate");
    } catch (error) {
      toast.error(errorMessage(error, "Salvataggio notifiche non riuscito"));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="text-sm text-text3">Caricamento profilo...</div>;
  if (!profile) return <div className="text-sm text-text3">Profilo non disponibile</div>;

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
          <Card className="max-w-2xl">
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
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Notifiche</CardTitle>
              <CardDescription>
                Preferenze personali usate dal sistema notifiche in-app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {NOTIFICATION_FIELDS.map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <Label htmlFor={key}>{label}</Label>
                    <Switch
                      id={key}
                      checked={notifications[key]}
                      onCheckedChange={(checked) =>
                        setNotifications((current) => ({ ...current, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Issue collegata: notifiche in-app real-time con inbox, badge e preferenze utente
                #57.
              </div>
              <Button onClick={submitNotifications} disabled={saving === "notifications"}>
                <Save className="mr-2 h-4 w-4" />
                {saving === "notifications" ? "Salvataggio..." : "Salva preferenze"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
