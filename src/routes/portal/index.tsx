import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestPortalLogin } from "@/lib/portal-auth";

export const Route = createFileRoute("/portal/")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const requestLogin = useServerFn(requestPortalLogin);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      localStorage.setItem("pcready_portal_token", token);
      navigate({ to: "/portal/dashboard", replace: true });
    }
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLogin({ data: { email } });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore invio magic link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Accedi al portale cliente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inserisci l'email del referente registrato per ricevere il link di accesso.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4">
        <input className="pc-input w-full" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@azienda.it" required />
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Invio..." : "Invia magic link"}</Button>
        {sent && <p className="text-sm text-muted-foreground">Se l'email è abilitata, riceverai a breve il link di accesso.</p>}
      </form>
    </div>
  );
}
