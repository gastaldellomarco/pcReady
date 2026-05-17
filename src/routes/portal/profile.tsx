import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { updatePortalContactProfile, validatePortalSession } from "@/lib/portal-auth";

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function PortalProfilePage() {
  const validate = useServerFn(validatePortalSession);
  const updateProfile = useServerFn(updatePortalContactProfile);
  const [token, setToken] = useState("");
  const [session, setSession] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const stored = localStorage.getItem("pcready_portal_token") || "";
    if (!stored) {
      window.location.href = "/portal";
      return;
    }
    setToken(stored);
    setLoading(true);
    setError("");
    validate({ data: { token: stored } })
      .then((result) => {
        setSession(result);
        setFullName(result.contactName || "");
        setPhone(result.contactPhone || "");
        setJobTitle(result.contactJobTitle || result.contactRole || "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [validate]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ data: { token, fullName, phone, jobTitle, password: password || null } });
      setPassword("");
      toast.success("Profilo aggiornato");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio profilo");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <PageFetchError variant="portal" message={error} onRetry={load} />;
  if (loading || !session) return <LoadingSkeleton variant="portal" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Profilo referente</h1>
        <p className="text-sm text-muted-foreground">Aggiorna i tuoi dati di contatto per il team tecnico.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <label className="text-sm font-medium">Nome e cognome</label>
          <input className="pc-input mt-1 w-full" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input className="pc-input mt-1 w-full" value={session.contactEmail || ""} disabled />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Telefono</label>
            <input className="pc-input mt-1 w-full" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Ruolo aziendale</label>
            <input className="pc-input mt-1 w-full" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Nuova password portale</label>
          <input className="pc-input mt-1 w-full" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Lascia vuoto per non cambiarla" />
          <p className="mt-1 text-xs text-muted-foreground">Dopo averla impostata potrai accedere anche con email e password.</p>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Salvataggio..." : "Salva profilo"}</Button>
      </form>
    </div>
  );
}
