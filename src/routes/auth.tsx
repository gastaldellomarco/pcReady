import {
  createFileRoute,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { appVersion, viteDeploymentLabel } from "@/lib/app-version-display";
import { initTheme } from "@/lib/theme";
import { assertStaffLoginRateLimit } from "@/lib/auth-rate-limit";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";
import { toast } from "sonner";
import { getMfaClientStatus, rememberChallengeStarted } from "@/lib/mfa-client";

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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AuthPage() {
  const { session, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const route = useRouterState({ select: (state) => state.location.pathname });
  const assertLoginLimit = useServerFn(assertStaffLoginRateLimit);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initTheme();
  }, []);

  if (route !== "/auth") return <Outlet />;

  if (!loading && !profileLoading && session) {
    return (
      <Navigate
        to={profile?.password_set === false ? "/auth/set-password" : "/dashboard"}
        replace
      />
    );
  }

  const deploymentLabel = viteDeploymentLabel();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await assertLoginLimit({ data: { email } });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) throw error;
      const mfaStatus = await getMfaClientStatus(data.user?.id);
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
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center"
            style={{ background: "var(--text)" }}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--background)"
              strokeWidth={1.8}
              className="w-5 h-5"
            >
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <path d="M9 11.5h5M11.5 9v5" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              PCReady
            </div>
            <div className="text-[10px] text-text3" style={{ fontFamily: "var(--font-mono)" }}>
              v{appVersion}
              {deploymentLabel ? ` - ${deploymentLabel}` : null}
            </div>
          </div>
        </div>

        <div className="pc-card overflow-hidden">
          <div className="pc-card-hd">
            <span className="pc-card-title">Accedi</span>
          </div>
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
            <p className="text-[11px] text-text3 text-center mt-2">
              Gli account vengono creati solo dagli amministratori.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
