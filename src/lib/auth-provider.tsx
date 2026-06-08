import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Ctx, type AuthProfile } from "./auth-context";
import { getMyAuthProfile } from "./get-my-auth-profile";
import type { Session, User } from "@supabase/supabase-js";

interface ImpersonationState {
  targetUserId: string;
  targetProfile: AuthProfile;
  adminProfile: AuthProfile;
}

/**
 *
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const profileRequestId = useRef(0);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);

  const getProfile = useServerFn(getMyAuthProfile);

  const loadProfile = useCallback(
    async (accessToken?: string | null) => {
      const requestId = ++profileRequestId.current;
      setProfileLoading(true);
      setAuthError(null);

      try {
        const result = await getProfile({ data: { accessToken: accessToken ?? "" } });

        if (requestId !== profileRequestId.current) return;

        void i18n.changeLanguage(result.language);
        setProfile(result);
      } catch (err: unknown) {
        if (requestId !== profileRequestId.current) return;
        setProfile(null);
        setAuthError(errorMessage(err, "Impossibile caricare il profilo utente"));
      } finally {
        if (requestId === profileRequestId.current) setProfileLoading(false);
      }
    },
    [getProfile],
  );

  const applySession = useCallback(
    async (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      void supabase.realtime.setAuth(s?.access_token ?? null);

      if (!s?.user) {
        profileRequestId.current++;
        setProfile(null);
        setImpersonation(null);
        setProfileLoading(false);
        setAuthError(null);
        return;
      }

      await loadProfile(s?.access_token ?? null);
    },
    [loadProfile],
  );

  useEffect(() => {
    let active = true;
    const invalidateProfileRequests = () => {
      profileRequestId.current += 1;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s).finally(() => {
        if (active) setLoading(false);
      });
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (!active) return;
        if (error) throw error;
        return applySession(s);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthError(errorMessage(err, "Impossibile verificare la sessione"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      invalidateProfileRequests();
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  // The effective profile: when impersonating, use target profile; otherwise real profile
  const effectiveProfile = impersonation?.targetProfile ?? profile;

  const startImpersonation = useCallback(
    async (targetUserId: string) => {
      if (!profile || profile.role !== "admin") {
        setAuthError("Solo gli amministratori possono impersonare altri utenti");
        return;
      }

      const { data: { session: current } } = await supabase.auth.getSession();
      const token = current?.access_token;
      if (!token) {
        setAuthError("Sessione non valida");
        return;
      }

      try {
        const { getImpersonatedProfile, logImpersonationStart } =
          await import("@/lib/impersonation");

        const targetProfile = (await getImpersonatedProfile({
          data: { accessToken: token, targetUserId },
        })) as unknown as AuthProfile;

        // Log audit event (fire-and-forget)
        void logImpersonationStart({ data: { accessToken: token, targetUserId } });

        setImpersonation({
          targetUserId,
          targetProfile,
          adminProfile: profile,
        });
      } catch (err: unknown) {
        setAuthError(errorMessage(err, "Impossibile avviare l'impersonificazione"));
      }
    },
    [profile],
  );

  const endImpersonation = useCallback(async () => {
    if (!impersonation) return;

    const { data: { session: current } } = await supabase.auth.getSession();
    const token = current?.access_token;

    if (token) {
      const { logImpersonationEnd } = await import("@/lib/impersonation");
      void logImpersonationEnd({ data: { accessToken: token } });
    }

    setImpersonation(null);
  }, [impersonation]);

  const value = {
    session,
    user,
    profile: effectiveProfile,
    loading,
    profileLoading,
    authError,
    canEdit: effectiveProfile?.role === "admin" || effectiveProfile?.role === "tech",
    isAdmin: effectiveProfile?.role === "admin",
    hasPermission: (permission: string) => {
      if (!effectiveProfile) return false;
      if (effectiveProfile.role === "admin") return true;
      return (effectiveProfile.permissions ?? []).includes(permission);
    },
    isImpersonating: !!impersonation,
    impersonatingTargetId: impersonation?.targetUserId ?? null,
    startImpersonation,
    endImpersonation,
    refreshProfile: async () => {
      if (!user) return;
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      await loadProfile(current?.access_token);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
