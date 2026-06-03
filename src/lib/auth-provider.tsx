import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Ctx, type AuthProfile } from "./auth-context";
import { getMyAuthProfile } from "./get-my-auth-profile";
import type { Session, User } from "@supabase/supabase-js";


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

  const getProfile = useServerFn(getMyAuthProfile);

  const loadProfile = useCallback(async (accessToken?: string | null) => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    setAuthError(null);

    try {
      // Single server round-trip: profiles + user_profiles + role all in parallel via supabaseAdmin
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
  }, [getProfile]);

  const applySession = useCallback(
    async (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      void supabase.realtime.setAuth(s?.access_token ?? null);

      if (!s?.user) {
        profileRequestId.current++;
        setProfile(null);
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

  const value = {
    session,
    user,
    profile,
    loading,
    profileLoading,
    authError,
    canEdit: profile?.role === "admin" || profile?.role === "tech",
    isAdmin: profile?.role === "admin",
    refreshProfile: async () => {
      if (!user) return;
      const { data: { session: current } } = await supabase.auth.getSession();
      await loadProfile(current?.access_token);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
