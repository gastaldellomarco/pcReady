import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getPublicAppSettings, setClientAppSettings } from "@/lib/app-settings";
import { getMfaClientStatus } from "@/lib/mfa-client";

export interface AuthGuardState {
  /** True while initial auth/profile/secondary checks are in progress. */
  guardLoading: boolean;
  /** Non-null when MFA policy requires the user to configure 2FA. */
  mfaRequiredMessage: string | null;
  /** Organization name loaded from app settings (null until loaded). */
  organizationName: string | null;
}

/**
 * Encapsulates all auth‑guard side‑effects that the AppLayout needs on mount:
 *
 * 1. Redirect to `/auth` when there is no session.
 * 2. Redirect to `/auth/set-password` when `profile.password_set === false`.
 * 3. Load public app settings and cache them in `globalThis.__APP_SETTINGS__`.
 * 4. Check the user's MFA status and redirect to `/profile?tab=security` if
 *    MFA is required by policy but not yet configured.
 */
export function useAuthGuard(): AuthGuardState {
  const { session, profile, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const loadSettings = useServerFn(getPublicAppSettings);
  const [mfaChecking, setMfaChecking] = useState(false);
  const [mfaRequiredMessage, setMfaRequiredMessage] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  // ── 1. Redirect unauthenticated ──────────────────────────────────
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  // ── 2. Load public app settings ───────────────────────────────────
  useEffect(() => {
    if (!session?.access_token) return;
    loadSettings({ data: { accessToken: session.access_token } })
      .then((s) => {
        const org = s?.organization_name || null;
        setOrganizationName(org);
        setClientAppSettings(s || {});
        try {
          (globalThis as any).organizationName = org || "PCReady";
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, [loadSettings, session?.access_token]);

  // ── 3. MFA status & redirect ─────────────────────────────────────
  useEffect(() => {
    if (!session || !profile || profile.password_set === false || route.startsWith("/profile"))
      return;
    let active = true;
    setMfaChecking(true);
    getMfaClientStatus(session.user.id)
      .then((status) => {
        if (!active) return;
        if (status.needsChallenge) {
          navigate({ to: "/auth/2fa-challenge", replace: true });
          return;
        }
        const settings = (globalThis as any).__APP_SETTINGS__ || {};
        const required =
          settings.mfa_require_all_users === true ||
          (settings.mfa_require_admin_users === true && profile.role === "admin");
        if (required && !status.enabled) {
          const graceDays = Number(settings.mfa_grace_period_days ?? 7);
          const createdAt = new Date(session.user.created_at ?? Date.now()).getTime();
          const graceEndsAt = createdAt + Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
          const expired = Date.now() > graceEndsAt;
          setMfaRequiredMessage(
            expired
              ? "Configura il 2FA per sbloccare l'accesso operativo."
              : "Il 2FA è richiesto dalla policy aziendale: configuralo dal profilo.",
          );
          navigate({ to: "/profile", search: () => ({ tab: "security" }) as any, replace: true });
        } else {
          setMfaRequiredMessage(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setMfaChecking(false);
      });
    return () => {
      active = false;
    };
  }, [navigate, profile, route, session]);

  // ── 4. Password-set redirect ─────────────────────────────────────
  useEffect(() => {
    if (!loading && session && profile && !profile.password_set) {
      navigate({ to: "/auth/set-password", replace: true });
    }
  }, [loading, navigate, profile, session]);

  const guardLoading = loading || profileLoading || !session || mfaChecking;

  return { guardLoading, mfaRequiredMessage, organizationName };
}
