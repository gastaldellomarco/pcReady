import {
  createFileRoute,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLogo } from "@/components/brand/AppLogo";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { supabase } from "@/integrations/supabase/client";
import { appVersion, viteDeploymentLabel } from "@/lib/app-version-display";
import { useAuth } from "@/lib/auth-context";
import { assertStaffLoginRateLimit } from "@/lib/auth-rate-limit";
import { errorMessage } from "@/lib/errors";
import { getMfaClientStatus, rememberChallengeStarted } from "@/lib/mfa-client";
import { getSelfRegistrationStatus, registerSelf } from "@/lib/self-registration";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";
import staffLogin from "@/lib/staff-auth";
import { initTheme } from "@/lib/theme";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi - PCReady" },
      { name: "description", content: "Accedi a PCReady per gestire la preparazione dei tuoi PC." },
    ],
  }),
  component: AuthPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--bg2)" }}
    >
      <div className="w-full max-w-md">
        <LoadingSkeleton />
      </div>
    </div>
  ),
});

function AuthPage() {
  const { session, profile, loading, profileLoading, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const route = useRouterState({ select: (state) => state.location.pathname });
  const assertLoginLimit = useServerFn(assertStaffLoginRateLimit);
  const serverLogin = useServerFn(staffLogin);
  const checkRegistration = useServerFn(getSelfRegistrationStatus);
  const doRegister = useServerFn(registerSelf);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"login" | "register">("login");
  const [selfRegEnabled, setSelfRegEnabled] = useState(false);
  // Registration fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    initTheme();
    // Check if self-registration is enabled
    checkRegistration().then((r) => setSelfRegEnabled(!!r?.enabled)).catch(() => {});
  }, []);

  if (route !== "/auth") return <Outlet />;

  if (!loading && !profileLoading && session) {
    return (
      <Navigate
        to={profile?.password_set === false && !isImpersonating ? "/auth/set-password" : "/dashboard"}
        replace
      />
    );
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regPassword.length < 8) {
      toast.error("La password deve essere di almeno 8 caratteri");
      return;
    }
    setBusy(true);
    try {
      const result = await doRegister({
        data: { email: regEmail, fullName: regName, password: regPassword },
      });
      const respData = (result as any)?.data ?? (result as any);
      if (respData?.duplicate) {
        toast.success("Se l'email è già registrata, controlla la tua casella di posta.");
      } else if (respData?.approvalRequired) {
        toast.success("Registrazione inviata. Un amministratore approverà il tuo account.");
      } else {
        toast.success("Registrazione completata. Ora puoi accedere.");
      }
      setView("login");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
    } catch (err: unknown) {
      toast.error(formatServerFnErrorForToast(err, errorMessage(err, "Registrazione fallita")));
    } finally {
      setBusy(false);
    }
  }

  const deploymentLabel = viteDeploymentLabel();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await assertLoginLimit({ data: { email } });
      // Call server login and log full response for debugging
      const serverResp = await serverLogin({ data: { email, password: pwd } });
      console.debug("[auth] serverLogin response:", serverResp);
      const loginData = (serverResp as any)?.data ?? (serverResp as any);
      if (!loginData?.session) {
        console.error("[auth] missing session in serverLogin response", loginData);
        throw new Error("Authentication failed");
      }
      // Set session in client-side supabase so the app behaves as if signInWithPassword was called
      try {
        const setRes = await supabase.auth.setSession(loginData.session as any);
        console.debug("[auth] supabase.setSession result:", setRes);
      } catch (setErr) {
        console.error("[auth] supabase.setSession error:", setErr);
        throw setErr;
      }
      const { data: userData } = await supabase.auth.getUser();
      const mfaStatus = await getMfaClientStatus(userData?.user?.id);
      toast.success("Bentornato!");
      if (mfaStatus.needsChallenge) {
        rememberChallengeStarted();
        navigate({ to: "/auth/2fa-challenge" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      toast.error(formatServerFnErrorForToast(err, errorMessage(err, "Errore")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--bg2)" }}
    >
      <div className="w-full max-w-md pc-anim-in">
        <div className="mb-6 flex flex-col items-center justify-center gap-1 text-center">
          <AppLogo variant="horizontal" className="text-2xl" iconClassName="h-10 w-10" />
          <div className="text-[10px] text-text3" style={{ fontFamily: "var(--font-mono)" }}>
            v{appVersion}
            {deploymentLabel ? ` - ${deploymentLabel}` : null}
          </div>
        </div>

        <div className="pc-card overflow-hidden">
          <div className="pc-card-hd">
            <span className="pc-card-title">
              {view === "login" ? "Accedi" : "Registrati"}
            </span>
          </div>
          {view === "login" ? (
            <form onSubmit={submit} className="pc-card-body flex flex-col gap-3">
              <div>
                <label className="pc-label">Email</label>
                <input
                  className="pc-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@azienda.it"
                />
              </div>
              <div>
                <label className="pc-label">Password</label>
                <input
                  className="pc-input"
                  type="password"
                  required
                  minLength={6}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Password"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="pc-btn pc-btn-primary justify-center mt-1"
              >
                {busy ? "Attendere..." : "Accedi"}
              </button>
              {selfRegEnabled && (
                <p className="text-[11px] text-text3 text-center mt-1">
                  Non hai un account?{" "}
                  <button
                    type="button"
                    className="underline hover:text-text transition-colors"
                    onClick={() => setView("register")}
                  >
                    Registrati
                  </button>
                </p>
              )}
              {!selfRegEnabled && (
                <p className="text-[11px] text-text3 text-center mt-2">
                  Gli account vengono creati solo dagli amministratori.
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegister} className="pc-card-body flex flex-col gap-3">
              <div>
                <label className="pc-label">Nome completo</label>
                <input
                  className="pc-input"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Mario Rossi"
                />
              </div>
              <div>
                <label className="pc-label">Email</label>
                <input
                  className="pc-input"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu@azienda.it"
                />
              </div>
              <div>
                <label className="pc-label">Password</label>
                <input
                  className="pc-input"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="pc-btn pc-btn-primary justify-center mt-1"
              >
                {busy ? "Attendere..." : "Registrati"}
              </button>
              <p className="text-[11px] text-text3 text-center mt-1">
                Hai già un account?{" "}
                <button
                  type="button"
                  className="underline hover:text-text transition-colors"
                  onClick={() => setView("login")}
                >
                  Accedi
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
