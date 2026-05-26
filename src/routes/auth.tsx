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
import staffLogin from "@/lib/staff-auth";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";
import { toast } from "sonner";
import { getMfaClientStatus, rememberChallengeStarted } from "@/lib/mfa-client";
import { AppLogo } from "@/components/brand/AppLogo";
import { errorMessage } from "@/lib/errors";

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
  const { session, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const route = useRouterState({ select: (state) => state.location.pathname });
  const assertLoginLimit = useServerFn(assertStaffLoginRateLimit);
  const serverLogin = useServerFn(staffLogin);
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
