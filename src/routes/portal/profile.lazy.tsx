import { createLazyFileRoute } from "@tanstack/react-router";
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
  Globe,
  ShieldCheck,
  ShieldOff,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageFetchError } from "@/components/page-states";
import {
  updatePortalContactProfile,
  updatePortalContactLanguage,
  getPortalAccessHistory,
  setupPortal2FA,
  verifyPortal2FA,
  updatePortalNotificationPreferences,
  getPortalClientContacts,
} from "@/lib/portal-auth";
import { getPortalProfileOverview } from "@/lib/portal-tickets";

export const Route = createLazyFileRoute("/portal/profile")({
  component: PortalProfilePage,
});

function PortalProfilePage() {
  const loadOverview = useServerFn(getPortalProfileOverview);
  const updateProfile = useServerFn(updatePortalContactProfile);
  const updateLanguage = useServerFn(updatePortalContactLanguage);
  const loadAccessHistory = useServerFn(getPortalAccessHistory);
  const setup2FA = useServerFn(setupPortal2FA);
  const verify2FA = useServerFn(verifyPortal2FA);
  const updateNotifyPrefs = useServerFn(updatePortalNotificationPreferences);
  const loadContacts = useServerFn(getPortalClientContacts);
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Notification preferences (server-side)
  const [notifyPrefs, setNotifyPrefs] = useState<Record<string, boolean>>({
    ticket_updated: true,
    ticket_closed: true,
    document_available: true,
    bundle_expiring: true,
  });
  const [notifySaving, setNotifySaving] = useState(false);
  // Language, access history, 2FA, contacts
  const [lang, setLang] = useState<"it" | "en">("it");
  const [accessSessions, setAccessSessions] = useState<any[] | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAPending, setTwoFAPending] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFABusy, setTwoFABusy] = useState(false);
  const [clientContacts, setClientContacts] = useState<any[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  const { t, i18n } = useTranslation();

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
    const storedLang = localStorage.getItem("pcready_portal_lang") || "it";
    setLang(storedLang === "en" ? "en" : "it");
    setLoading(true);
    setError("");
    loadOverview({ data: { token: stored } })
      .then((result) => {
        setOverview(result);
        setFullName(result.session.contactName || "");
        setPhone(result.session.contactPhone || "");
        setJobTitle(result.session.contactJobTitle || result.session.contactRole || "");
        setTwoFAEnabled(result.session.twoFAEnabled ?? false);
        if (result.session.notificationPreferences) {
          setNotifyPrefs((prev) => ({ ...prev, ...result.session.notificationPreferences }));
        }
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

  async function switchLanguage(newLang: "it" | "en") {
    setLang(newLang);
    localStorage.setItem("pcready_portal_lang", newLang);
    i18n.changeLanguage(newLang);
    try {
      await updateLanguage({ data: { token, language: newLang } });
    } catch { /* non-blocking */ }
    toast.success(newLang === "it" ? "Lingua cambiata in Italiano" : "Language changed to English");
  }

  async function loadAccess() {
    setAccessLoading(true);
    try {
      const result = await loadAccessHistory({ data: { token } });
      setAccessSessions(result.sessions || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento accessi");
    } finally {
      setAccessLoading(false);
    }
  }

  async function toggle2FA() {
    setTwoFABusy(true);
    try {
      const result = await setup2FA({ data: { token, enable: !twoFAEnabled } });
      if (result.pending) {
        setTwoFAPending(true);
        toast.success("Codice di verifica inviato via email");
      } else if (result.enabled === false) {
        setTwoFAEnabled(false);
        setTwoFAPending(false);
        setTwoFACode("");
        toast.success("2FA disattivato");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore configurazione 2FA");
    } finally {
      setTwoFABusy(false);
    }
  }

  async function confirm2FA() {
    if (twoFACode.length !== 6) return;
    setTwoFABusy(true);
    try {
      const result = await verify2FA({ data: { token, code: twoFACode } });
      if (result.enabled) {
        setTwoFAEnabled(true);
        setTwoFAPending(false);
        setTwoFACode("");
        toast.success("2FA attivato con successo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Codice non valido");
    } finally {
      setTwoFABusy(false);
    }
  }
  async function saveNotificationPreferences() {
    setNotifySaving(true);
    try {
      const result = await updateNotifyPrefs({ data: { token, preferences: notifyPrefs } });
      if (result.preferences) setNotifyPrefs(result.preferences);
      toast.success("Preferenze notifiche salvate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio preferenze");
    } finally {
      setNotifySaving(false);
    }
  }

  async function loadClientContacts() {
    if (contactsLoading || clientContacts) return;
    setContactsLoading(true);
    try {
      const result = await loadContacts({ data: { token } });
      setClientContacts(result.contacts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento contatti");
    } finally {
      setContactsLoading(false);
    }
  }

  if (error) return <PageFetchError variant="portal" message={error} onRetry={load} />;
  if (loading || !overview || !session) return <LoadingSkeletonPortal />;

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

      <Tabs defaultValue="profile" className="space-y-5" onValueChange={(value) => {
        if (value === "access" && !accessSessions) loadAccess();
        if (value === "contacts" && !clientContacts) loadClientContacts();
      }}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-8">
          <TabsTrigger value="profile">Profilo</TabsTrigger>
          <TabsTrigger value="requests">Richieste</TabsTrigger>
          <TabsTrigger value="history">Interventi</TabsTrigger>
          <TabsTrigger value="documents">Documenti</TabsTrigger>
          <TabsTrigger value="contracts">Contratti</TabsTrigger>
          <TabsTrigger value="contacts">Contatti</TabsTrigger>
          <TabsTrigger value="access">Accessi</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" /> Dati personali
              </CardTitle>
              <CardDescription>
                Modifica nome, telefono, ruolo, lingua e password di accesso al portale.
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
                {/* Language switcher */}
                <Field label="Lingua">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={lang === "it" ? "default" : "outline"}
                      size="sm"
                      onClick={() => switchLanguage("it")}
                    >
                      <Globe className="mr-1.5 h-4 w-4" />
                      Italiano
                    </Button>
                    <Button
                      type="button"
                      variant={lang === "en" ? "default" : "outline"}
                      size="sm"
                      onClick={() => switchLanguage("en")}
                    >
                      <Globe className="mr-1.5 h-4 w-4" />
                      English
                    </Button>
                  </div>
                </Field>
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
              <CardDescription>Scegli per quali eventi ricevere notifiche email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationToggle
                label="Ticket aggiornato dal tecnico"
                checked={notifyPrefs.ticket_updated}
                onChange={(v) => setNotifyPrefs((p) => ({ ...p, ticket_updated: v }))}
              />
              <NotificationToggle
                label="Ticket completato / chiuso"
                checked={notifyPrefs.ticket_closed}
                onChange={(v) => setNotifyPrefs((p) => ({ ...p, ticket_closed: v }))}
              />
              <NotificationToggle
                label="Nuovo documento disponibile"
                checked={notifyPrefs.document_available}
                onChange={(v) => setNotifyPrefs((p) => ({ ...p, document_available: v }))}
              />
              <NotificationToggle
                label="Contratto / bundle in scadenza"
                checked={notifyPrefs.bundle_expiring}
                onChange={(v) => setNotifyPrefs((p) => ({ ...p, bundle_expiring: v }))}
              />
              <Button variant="outline" onClick={saveNotificationPreferences} disabled={notifySaving}>
                {notifySaving ? "Salvataggio..." : "Salva preferenze"}
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

        {/* Contacts tab (multi-referent) */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Referenti aziendali
              </CardTitle>
              <CardDescription>
                Tutti i contatti della tua azienda con accesso al portale. Ogni referente accede con le proprie credenziali e vede gli stessi dati aziendali.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : !clientContacts?.length ? (
                <EmptyText text="Nessun contatto disponibile." />
              ) : (
                <div className="space-y-2">
                  {clientContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {contact.fullName
                            ? contact.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase()
                            : "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {contact.fullName}
                              {contact.isSelf ? " (tu)" : ""}
                            </p>
                            {contact.isPrimary && (
                              <Badge variant="default" className="text-[10px]">Referente</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {contact.phone && <span>{contact.phone}</span>}
                            {contact.jobTitle && <span>{contact.jobTitle}</span>}
                            {contact.department && <span>{contact.department}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Storico accessi
              </CardTitle>
              <CardDescription>Ultimi accessi al portale con data, ora e stato.</CardDescription>
            </CardHeader>
            <CardContent>
              {accessLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : !accessSessions?.length ? (
                <EmptyText text="Nessuna sessione di accesso disponibile." />
              ) : (
                <div className="space-y-2">
                  {accessSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-1.5 ${session.isActive ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {session.isActive ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : session.isRevoked ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(session.createdAt).toLocaleString("it-IT")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ultimo utilizzo: {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString("it-IT") : "—"}
                            {session.isRevoked ? " · Revocata" : session.isActive ? " · Attiva" : " · Scaduta"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.isActive ? "default" : "secondary"}>
                        {session.isRevoked ? "Revocata" : session.isActive ? "Attiva" : "Scaduta"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security tab (2FA) */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {twoFAEnabled ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                Autenticazione a due fattori
              </CardTitle>
              <CardDescription>
                {twoFAEnabled
                  ? "La verifica in due passaggi è attiva. Riceverai un codice via email a ogni accesso."
                  : "Aggiungi un livello di sicurezza extra al tuo account con la verifica via email."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Verifica email</p>
                  <p className="text-xs text-muted-foreground">
                    {twoFAEnabled
                      ? "Riceverai un codice di 6 cifre via email ad ogni accesso."
                      : "Attiva per ricevere un codice via email a ogni accesso."}
                  </p>
                </div>
                <Switch
                  checked={twoFAEnabled}
                  onCheckedChange={() => toggle2FA()}
                  disabled={twoFABusy}
                />
              </div>

              {twoFAPending && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm">Abbiamo inviato un codice di 6 cifre alla tua email. Inseriscilo qui sotto per attivare la 2FA.</p>
                  <div className="flex gap-2">
                    <Input
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-32 text-center font-mono text-lg tracking-widest"
                    />
                    <Button
                      onClick={() => confirm2FA()}
                      disabled={twoFACode.length !== 6 || twoFABusy}
                    >
                      {twoFABusy ? "Verifica..." : "Verifica"}
                    </Button>
                  </div>
                </div>
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

function LoadingSkeletonPortal() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
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
