import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  FileText,
  History,
  Lock,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { updatePortalContactProfile } from "@/lib/portal-auth";
import { getPortalProfileOverview } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function PortalProfilePage() {
  const loadOverview = useServerFn(getPortalProfileOverview);
  const updateProfile = useServerFn(updatePortalContactProfile);
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyStatus, setNotifyStatus] = useState(true);
  const [notifyReports, setNotifyReports] = useState(true);

  const session = overview?.session;

  const initials = useMemo(() => {
    const base = fullName || session?.contactEmail || "U";
    return (
      base
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, [fullName, session?.contactEmail]);

  const load = useCallback(() => {
    const stored = localStorage.getItem("pcready_portal_token") || "";
    if (!stored) {
      window.location.href = "/portal";
      return;
    }
    setToken(stored);
    const storedPrefs = localStorage.getItem(`pcready_portal_notification_prefs_${stored}`);
    if (storedPrefs) {
      try {
        const parsed = JSON.parse(storedPrefs) as Record<string, boolean>;
        setNotifyEmail(parsed.notifyEmail ?? true);
        setNotifyStatus(parsed.notifyStatus ?? true);
        setNotifyReports(parsed.notifyReports ?? true);
      } catch {
        // Keep defaults when local preferences are malformed.
      }
    }
    setLoading(true);
    setError("");
    loadOverview({ data: { token: stored } })
      .then((result) => {
        setOverview(result);
        setFullName(result.session.contactName || "");
        setPhone(result.session.contactPhone || "");
        setJobTitle(result.session.contactJobTitle || result.session.contactRole || "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        data: { token, fullName, phone, jobTitle, password: password || null },
      });
      setPassword("");
      toast.success("Profilo aggiornato");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio profilo");
    } finally {
      setBusy(false);
    }
  }

  function saveNotificationPreferences() {
    if (token) {
      localStorage.setItem(
        `pcready_portal_notification_prefs_${token}`,
        JSON.stringify({ notifyEmail, notifyStatus, notifyReports }),
      );
    }
    toast.success("Preferenze notifiche salvate");
  }

  if (error) return <PageFetchError variant="portal" message={error} onRetry={load} />;
  if (loading || !overview || !session) return <LoadingSkeleton variant="portal" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profilo referente</h1>
            <p className="text-sm text-muted-foreground">
              {session.clientName} · {session.contactEmail}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Richieste" value={overview.stats.submittedRequests} />
          <MiniStat label="Aperte" value={overview.stats.openRequests} />
          <MiniStat label="Interventi" value={overview.stats.completedInterventions} />
          <MiniStat label="Contratti" value={overview.stats.activeContracts} />
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="profile">Dati profilo</TabsTrigger>
          <TabsTrigger value="requests">Richieste</TabsTrigger>
          <TabsTrigger value="history">Interventi</TabsTrigger>
          <TabsTrigger value="documents">Documenti</TabsTrigger>
          <TabsTrigger value="contracts">Contratti</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" /> Dati personali
              </CardTitle>
              <CardDescription>
                Modifica nome, telefono, ruolo e password di accesso al portale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome e cognome">
                    <Input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Email">
                    <Input value={session.contactEmail || ""} disabled />
                  </Field>
                  <Field label="Telefono">
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+39 ..."
                    />
                  </Field>
                  <Field label="Ruolo aziendale">
                    <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
                  </Field>
                </div>
                <Field label="Nuova password portale">
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Lascia vuoto per non cambiarla"
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? "Salvataggio..." : "Salva profilo"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Preferenze notifiche
              </CardTitle>
              <CardDescription>Configura gli aggiornamenti che desideri ricevere.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationToggle
                label="Email sulle nuove risposte"
                checked={notifyEmail}
                onChange={setNotifyEmail}
              />
              <NotificationToggle
                label="Cambio stato richieste"
                checked={notifyStatus}
                onChange={setNotifyStatus}
              />
              <NotificationToggle
                label="Report e documenti"
                checked={notifyReports}
                onChange={setNotifyReports}
              />
              <Button variant="outline" onClick={saveNotificationPreferences}>
                Salva preferenze
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Richieste di assistenza inviate</CardTitle>
              <CardDescription>
                Stato corrente delle richieste aperte dal tuo account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.requests.length ? (
                overview.requests.map((ticket: any) => (
                  <RowCard
                    key={ticket.id}
                    icon={<Mail className="h-4 w-4" />}
                    title={`${ticket.ticket_code} · ${ticket.title}`}
                    meta={`Aggiornato ${formatDate(ticket.updated_at)}`}
                    badge={ticket.status_label}
                  >
                    {ticket.assignee_name ? (
                      <span>Tecnico: {ticket.assignee_name}</span>
                    ) : (
                      <span>In attesa assegnazione</span>
                    )}
                  </RowCard>
                ))
              ) : (
                <EmptyText text="Non hai ancora inviato richieste di assistenza." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Storico interventi ricevuti
              </CardTitle>
              <CardDescription>Interventi completati per la tua azienda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.interventions.length ? (
                overview.interventions.map((item: any) => (
                  <RowCard
                    key={item.id}
                    icon={<Phone className="h-4 w-4" />}
                    title={`${item.ticket_code} · ${item.title}`}
                    meta={formatDate(item.date)}
                    badge={item.duration_hours ? `${item.duration_hours}h` : item.status_label}
                  >
                    {item.technician ? (
                      <span>Tecnico: {item.technician}</span>
                    ) : (
                      <span>Report: {item.report || "non disponibile"}</span>
                    )}
                  </RowCard>
                ))
              ) : (
                <EmptyText text="Nessun intervento completato disponibile." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Documenti e report associati
              </CardTitle>
              <CardDescription>
                Allegati e report collegati ai ticket della tua azienda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.documents.length ? (
                overview.documents.map((doc: any) => (
                  <RowCard
                    key={doc.id}
                    icon={<FileText className="h-4 w-4" />}
                    title={doc.file_name}
                    meta={`${doc.ticket_code || "Ticket"} · ${formatDate(doc.created_at)}`}
                    badge={formatFileSize(doc.file_size)}
                  >
                    <span>{doc.ticket_title || "Documento associato"}</span>
                  </RowCard>
                ))
              ) : (
                <EmptyText text="Nessun documento disponibile al momento." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5" /> Contratti attivi
              </CardTitle>
              <CardDescription>Condizioni di assistenza attualmente attive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.contracts.length ? (
                overview.contracts.map((contract: any) => (
                  <RowCard
                    key={contract.id}
                    icon={<Lock className="h-4 w-4" />}
                    title={contract.name}
                    meta={`${formatDate(contract.start_date)}${contract.end_date ? ` - ${formatDate(contract.end_date)}` : ""}`}
                    badge={contract.billing_period === "annual" ? "Annuale" : "Mensile"}
                  >
                    <span>
                      {contract.included_hours}h incluse · €{contract.extra_hourly_rate}/h extra
                    </span>
                  </RowCard>
                ))
              ) : (
                <EmptyText text="Nessun contratto attivo associato al tuo profilo." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NotificationToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RowCard({
  icon,
  title,
  meta,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <div className="font-medium">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
          <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
      <Badge variant="secondary" className="w-fit">
        {badge}
      </Badge>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return "File";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
}
