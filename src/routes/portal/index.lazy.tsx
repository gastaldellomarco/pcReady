import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { loginPortalWithPassword, verifyPortalLogin2FA } from "@/lib/portal-auth";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";

export const Route = createLazyFileRoute("/portal/")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const passwordLogin = useServerFn(loginPortalWithPassword);
  const verify2FA = useServerFn(verifyPortalLogin2FA);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [code, setCode] = useState("");

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
      if (result.requires2FA) {
        setRequires2FA(true);
        setPendingToken(result.pendingToken);
        toast.success("Codice di verifica inviato alla tua email");
      } else {
        localStorage.setItem("pcready_portal_token", result.token);
        navigate({ to: "/portal/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(formatServerFnErrorForToast(error, "Credenziali non valide"));
    } finally {
      setBusy(false);
    }
  }

  async function submit2FACode(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const result = await verify2FA({ data: { pendingToken, code } });
      localStorage.setItem("pcready_portal_token", result.token);
      navigate({ to: "/portal/dashboard", replace: true });
    } catch (error) {
      toast.error(formatServerFnErrorForToast(error, "Codice non valido o scaduto"));
    } finally {
      setBusy(false);
    }
  }

  function goBackToLogin() {
    setRequires2FA(false);
    setPendingToken("");
    setCode("");
  }

  // ── 2FA verification step ──
  if (requires2FA) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Verifica in due passaggi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Abbiamo inviato un codice di 6 cifre a <strong>{email}</strong>.
            Inseriscilo qui sotto per completare l'accesso.
          </p>
        </div>
        <form onSubmit={submit2FACode} className="space-y-4 rounded-lg border bg-card p-4">
          <div>
            <label className="text-sm font-medium">Codice di verifica</label>
            <input
              className="pc-input mt-1 w-full text-center font-mono text-2xl tracking-[0.5em]"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            className="pc-btn pc-btn-primary w-full"
            disabled={busy || code.length !== 6}
          >
            {busy ? "Verifica..." : "Verifica e accedi"}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-ghost w-full text-sm"
            onClick={goBackToLogin}
            disabled={busy}
          >
            Torna al login
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Il codice scade dopo 10 minuti. Se non lo ricevi, controlla la cartella spam o{" "}
          <button onClick={goBackToLogin} className="underline hover:text-foreground">
            riprova l'accesso
          </button>.
        </p>
      </div>
    );
  }

  // ── Login form ──
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
