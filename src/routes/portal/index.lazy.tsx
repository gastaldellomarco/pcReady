import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { loginPortalWithPassword } from "@/lib/portal-auth";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";

export const Route = createLazyFileRoute("/portal/")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const passwordLogin = useServerFn(loginPortalWithPassword);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      localStorage.setItem("pcready_portal_token", token);
      navigate({ to: "/portal/dashboard", replace: true });
    }
  }, [navigate]);

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await passwordLogin({ data: { email, password } });
      localStorage.setItem("pcready_portal_token", result.token);
      navigate({ to: "/portal/dashboard", replace: true });
    } catch (error) {
      toast.error(formatServerFnErrorForToast(error, "Credenziali non valide"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Accedi al portale cliente</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inserisci indirizzo email del referente registrato per ricevere il link di accesso.
        </p>
      </div>
      <form onSubmit={submitPassword} className="space-y-4 rounded-lg border bg-card p-4">
        <input
          className="pc-input w-full"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@azienda.it"
          required
        />
        <input
          className="pc-input w-full"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password portale"
        />
        <button type="submit" className="pc-btn pc-btn-primary w-full" disabled={busy || !password}>
          {busy ? "Accesso..." : "Accedi con password"}
        </button>
      </form>
    </div>
  );
}
