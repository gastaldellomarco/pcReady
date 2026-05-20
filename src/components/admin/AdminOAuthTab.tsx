import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  Plus,
  BookOpen,
  Copy,
  ChevronDown,
  History,
  KeyRound,
  Ban,
  RotateCcw,
  Skull,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { fmtDateTime } from "@/lib/pcready";
import type { OAuthClientInfo } from "@/lib/oauth-consent";
import { useAuth } from "@/lib/auth-context";
import { OAUTH_SCOPES, getScopeLabel } from "@/lib/oauth-scopes";
import { useAdminOAuthClients } from "@/hooks/useAdminOAuthClients";
import OverflowTable from "@/components/ui/overflow-table";

export function AdminOAuthTab() {
  const { session, isAdmin } = useAuth();
  const accessToken = session?.access_token;
  const {
    clients,
    loadingClients,
    oauthForm,
    createNewClient,
    createClientBusy,
    oauthCreated,
    setOauthCreated,
    rotatedSecret,
    setRotatedSecret,
    copyOAuthField,
    rotateClientSecret,
    actionBusyId,
    lifecycleOpenFor,
    lifecycleData,
    lifecycleLoading,
    openLifecycle,
    closeLifecycle,
  } = useAdminOAuthClients({ accessToken, isAdmin });

  const [rotateTarget, setRotateTarget] = useState<OAuthClientInfo | null>(null);
  const [disableTarget, setDisableTarget] = useState<OAuthClientInfo | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OAuthClientInfo | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const wizardSteps = [
    {
      title: "Identità app",
      description: "Nome e descrizione leggibili dagli admin e dagli utenti.",
    },
    {
      title: "Callback",
      description: "URL sicuri a cui PCReady può rimandare l'utente dopo il consenso.",
    },
    {
      title: "Permessi",
      description: "Ambiti dati che l'app potrà richiedere durante l'autorizzazione.",
    },
  ];

  return (
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
              modo sicuro, senza condividere le password degli utenti. Crea un client solo se stai
              collegando un&apos;applicazione esterna che deve operare per conto degli utenti che la
              autorizzano.
            </AlertDescription>
          </Alert>

          <Alert className="mb-4 border-muted bg-muted/40">
            <AlertTitle className="text-foreground">Flusso supportato</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              PCReady espone il flusso OAuth 2.0{" "}
              <strong className="text-foreground">Authorization Code</strong> (
              <code className="text-xs">response_type=code</code>). Gli integratori avviano
              l&apos;accesso reindirizzando l&apos;utente all&apos;endpoint di autorizzazione, poi
              scambiano il codice per un token. Il flusso{" "}
              <strong className="text-foreground">Client Credentials</strong> non è supportato per
              questi client.
            </AlertDescription>
          </Alert>

          <form onSubmit={createNewClient} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {wizardSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className="rounded-xl border p-3 text-left transition-colors"
                  style={{
                    borderColor: wizardStep === index ? "var(--primary)" : "var(--border)",
                    background: wizardStep === index ? "var(--primary-light)" : "var(--background)",
                  }}
                  onClick={() => setWizardStep(index)}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Passo {index + 1}
                  </div>
                  <div className="mt-1 font-semibold">{step.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </button>
              ))}
            </div>

            {wizardStep === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Nome applicazione</Label>
                  <Input
                    id="clientName"
                    {...oauthForm.register("name")}
                    placeholder="Es. CRM Aziendale"
                  />
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
            )}
            {wizardStep === 1 && (
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
                  coincidere <strong>esattamente</strong> con quanto configurato nell&apos;app
                  esterna: trovi il valore nella documentazione o nelle impostazioni sviluppatore di
                  quell&apos;app. Una URL per riga. Esempio:{" "}
                  <code className="text-[11px] rounded bg-muted px-1 py-0.5">
                    https://myapp.com/oauth/callback
                  </code>
                </p>
              </div>
            )}
            {wizardStep === 2 && (
              <div>
                <Label>Permessi consentiti (scope)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Seleziona cosa l&apos;applicazione potrà chiedere agli utenti durante
                  l&apos;autorizzazione. Ogni voce mostra il nome tecnico del permesso tra
                  parentesi.
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
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={wizardStep === 0}
                onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
              >
                Indietro
              </Button>
              {wizardStep < wizardSteps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))
                  }
                >
                  Continua
                </Button>
              ) : (
                <Button type="submit" disabled={createClientBusy || !oauthForm.formState.isValid}>
                  <Plus className="w-4 h-4 mr-2" />
                  {createClientBusy ? "Creazione..." : "Crea client"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={!!oauthCreated}
        onOpenChange={(open) => {
          if (!open) setOauthCreated(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto xs:fixed xs:inset-0 xs:m-0 xs:max-w-full xs:h-full xs:rounded-none xs:overflow-y-auto">
          {oauthCreated ? (
            <>
              <DialogHeader>
                <DialogTitle>Client creato</DialogTitle>
                <DialogDescription>
                  {oauthCreated.name}: usa questi valori nella tua applicazione. Il secret non sarà
                  più mostrato.
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
                    <code className="rounded bg-muted px-1">state</code> con i valori della tua app.
                  </p>
                  <div>
                    <span className="font-medium text-foreground">GET — autorizzazione</span>
                    <pre className="mt-1 p-2 rounded-md bg-muted font-mono text-[11px] break-all whitespace-pre-wrap">
                      {`${typeof window !== "undefined" ? window.location.origin : ""}/oauth/authorize?client_id=${encodeURIComponent(oauthCreated.clientId)}&redirect_uri=${encodeURIComponent(oauthCreated.exampleRedirectUri || "https://esempio.app/oauth/callback")}&response_type=code&scope=${encodeURIComponent(oauthCreated.scopesAllowed.length ? oauthCreated.scopesAllowed.join(" ") : "openid profile email")}&state=STATO_OPZIONALE`}
                    </pre>
                  </div>
                  <p>
                    Dopo il consenso, l&apos;utente torna al{" "}
                    <code className="rounded bg-muted px-1">redirect_uri</code> con un{" "}
                    <code className="rounded bg-muted px-1">code</code> temporaneo.
                  </p>
                  <div>
                    <span className="font-medium text-foreground">POST — scambio code → token</span>
                    <pre className="mt-1 p-2 rounded-md bg-muted font-mono text-[11px] break-all whitespace-pre-wrap">
                      {`${typeof window !== "undefined" ? window.location.origin : ""}/oauth/token`}
                    </pre>
                    <p className="mt-1">
                      Corpo tipico:{" "}
                      <code className="rounded bg-muted px-1">grant_type=authorization_code</code>,{" "}
                      <code className="rounded bg-muted px-1">code</code>,{" "}
                      <code className="rounded bg-muted px-1">client_id</code>,{" "}
                      <code className="rounded bg-muted px-1">client_secret</code>,{" "}
                      <code className="rounded bg-muted px-1">redirect_uri</code> (come sopra).
                      Dettagli e schema nella{" "}
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

      <Dialog
        open={!!rotatedSecret}
        onOpenChange={(open) => {
          if (!open) setRotatedSecret(null);
        }}
      >
        <DialogContent className="max-w-lg xs:fixed xs:inset-0 xs:m-0 xs:max-w-full xs:h-full xs:rounded-none xs:overflow-y-auto">
          {rotatedSecret ? (
            <>
              <DialogHeader>
                <DialogTitle>Nuovo Client Secret</DialogTitle>
                <DialogDescription>
                  Il secret precedente non e&apos; piu&apos; valido. Aggiorna subito le integrazioni
                  che usano questo client.
                </DialogDescription>
              </DialogHeader>
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>Copia ora</AlertTitle>
                <AlertDescription>
                  Questo valore non verra&apos; mostrato di nuovo dopo la chiusura della finestra.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Client Secret</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyOAuthField("Client Secret", rotatedSecret.clientSecret)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copia
                  </Button>
                </div>
                <pre className="p-2 rounded-md bg-muted text-xs font-mono break-all whitespace-pre-wrap">
                  {rotatedSecret.clientSecret}
                </pre>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setRotatedSecret(null)}>
                  Ho aggiornato le integrazioni, chiudi
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
              {(Array.isArray(clients) ? clients : []).map((client) => {
                const busy = actionBusyId === client.clientId;
                const statusLabel =
                  client.status === "active"
                    ? "Attivo"
                    : client.status === "disabled"
                      ? "Disattivato"
                      : "Revocato";
                const statusVariant =
                  client.status === "active"
                    ? "default"
                    : client.status === "disabled"
                      ? "secondary"
                      : "destructive";
                return (
                  <div key={client.clientId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold">{client.name}</h4>
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                        </div>
                        {client.description && (
                          <p className="text-sm text-muted-foreground mt-1">{client.description}</p>
                        )}
                        <p className="text-xs font-mono text-muted-foreground mt-2 break-all">
                          Client ID: {client.clientId}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Creato:{" "}
                            <span className="text-foreground">{fmtDateTime(client.createdAt)}</span>
                          </span>
                          <span>
                            Ultima attivita:{" "}
                            <span className="text-foreground">
                              {client.lastUsedAt ? fmtDateTime(client.lastUsedAt) : "—"}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void openLifecycle(client.clientId)}
                        >
                          <History className="h-3.5 w-3.5 mr-1" />
                          Storico
                        </Button>
                        {client.status === "active" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setRotateTarget(client)}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Ruota secret
                          </Button>
                        ) : null}
                        {client.status === "active" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setDisableTarget(client)}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            Disattiva
                          </Button>
                        ) : null}
                        {client.status === "disabled" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void updateClientStatus(client.clientId, "active")}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Riattiva
                          </Button>
                        ) : null}
                        {client.status !== "revoked" ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => setRevokeTarget(client)}
                          >
                            <Skull className="h-3.5 w-3.5 mr-1" />
                            Revoca
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!lifecycleOpenFor} onOpenChange={(o) => !o && closeLifecycle()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto xs:fixed xs:inset-0 xs:m-0 xs:max-w-full xs:h-full xs:rounded-none xs:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Storico client OAuth</DialogTitle>
            <DialogDescription>
              Consensi utenti, codici di autorizzazione recenti e azioni amministrative.
            </DialogDescription>
          </DialogHeader>
          {lifecycleLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Caricamento...</p>
          ) : lifecycleData && lifecycleOpenFor ? (
            <div className="space-y-6 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Consensi ({lifecycleData.consents.length})</h4>
                {lifecycleData.consents.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Nessun consenso registrato.</p>
                ) : (
                  <OverflowTable className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Utente</th>
                          <th className="text-left p-2">Scope</th>
                          <th className="text-left p-2">Concesso</th>
                          <th className="text-left p-2">Revoca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lifecycleData.consents.map((c) => (
                          <tr key={`${c.userId}-${c.grantedAt}`} className="border-t">
                            <td className="p-2 align-top">
                              {c.userName || (
                                <span className="font-mono">{c.userId.slice(0, 8)}…</span>
                              )}
                            </td>
                            <td className="p-2 align-top font-mono text-[10px]">
                              {c.scopesGranted.join(", ")}
                            </td>
                            <td className="p-2 align-top whitespace-nowrap">
                              {fmtDateTime(c.grantedAt)}
                            </td>
                            <td className="p-2 align-top whitespace-nowrap">
                              {c.revokedAt ? fmtDateTime(c.revokedAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </OverflowTable>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Codici di autorizzazione (recenti)</h4>
                {lifecycleData.authorizationEvents.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Nessun codice registrato.</p>
                ) : (
                  <OverflowTable className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Creato</th>
                          <th className="text-left p-2">Scadenza</th>
                          <th className="text-left p-2">Stato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lifecycleData.authorizationEvents.map((row, i) => (
                          <tr key={`${row.createdAt}-${i}`} className="border-t">
                            <td className="p-2 whitespace-nowrap">{fmtDateTime(row.createdAt)}</td>
                            <td className="p-2 whitespace-nowrap">{fmtDateTime(row.expiresAt)}</td>
                            <td className="p-2">
                              {row.redeemed ? "Riscattato" : "Non riscattato"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </OverflowTable>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Audit amministrativo</h4>
                {lifecycleData.adminEvents.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Nessuna voce.</p>
                ) : (
                  <ul className="border rounded-md divide-y max-h-40 overflow-y-auto text-xs">
                    {lifecycleData.adminEvents.map((ev) => (
                      <li key={ev.id} className="p-2">
                        <div className="text-muted-foreground">{fmtDateTime(ev.createdAt)}</div>
                        <div>{ev.message}</div>
                        {ev.actionType ? (
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {ev.actionType}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={closeLifecycle}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={!!rotateTarget}
        title="Ruotare il Client Secret?"
        description={
          rotateTarget
            ? `Ruotando il secret per "${rotateTarget.name}", il valore attuale smette di funzionare immediatamente. Tutte le integrazioni che usano il vecchio secret falliranno finche' non aggiorni la configurazione. Questa azione viene registrata in audit.`
            : ""
        }
        confirmLabel="Ruota secret"
        loadingLabel="Rotazione..."
        onOpenChange={(open) => !open && setRotateTarget(null)}
        onConfirm={async () => {
          if (!rotateTarget) return;
          const uri = rotateTarget.redirectUris[0] ?? "";
          await rotateClientSecret(rotateTarget.clientId, uri);
          setRotateTarget(null);
        }}
      />

      <DestructiveConfirmDialog
        open={!!disableTarget}
        title="Disattivare questo client?"
        description={
          disableTarget
            ? `Il client "${disableTarget.name}" non potra' avviare nuovi flussi OAuth finche' non lo riattivi. I consensi esistenti restano in archivio.`
            : ""
        }
        confirmLabel="Disattiva"
        loadingLabel="Disattivazione..."
        onOpenChange={(open) => !open && setDisableTarget(null)}
        onConfirm={async () => {
          if (!disableTarget) return;
          await updateClientStatus(disableTarget.clientId, "disabled");
          setDisableTarget(null);
        }}
      />

      <DestructiveConfirmDialog
        open={!!revokeTarget}
        title="Revocare definitivamente questo client?"
        description={
          revokeTarget
            ? `La revoca di "${revokeTarget.name}" e' irreversibile: non potrai riattivare questo client. Crea un nuovo client se serve un'integrazione analoga.`
            : ""
        }
        confirmLabel="Revoca client"
        loadingLabel="Revoca..."
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          await updateClientStatus(revokeTarget.clientId, "revoked");
          setRevokeTarget(null);
        }}
      />
    </TabsContent>
  );
}
