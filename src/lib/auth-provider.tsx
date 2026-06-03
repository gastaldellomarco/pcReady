import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { getMyRole } from "@/lib/get-my-role";
import { Ctx, type AppRole, type AuthProfile } from "./auth-context";
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

  const getRole = useServerFn(getMyRole);

  const loadProfile = useCallback(async (uid: string, accessToken?: string | null) => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    setAuthError(null);

    try {
      const [
        { data: p, error: profileError },
        { data: up, error: userProfileError },
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, initials").eq("id", uid).maybeSingle(),
        supabase
          .from("user_profiles")
          .select("display_name, avatar_url, password_set, language")
          .eq("id", uid)
          .maybeSingle(),
      ]);

      // Fetch role server-side to avoid exposing admin RPC to client
      let r: any = null;
      let roleError: unknown = null;
      try {
        const roleResp = await getRole({ data: { accessToken: accessToken ?? "" } });
        r = roleResp as any;
      } catch (e) {
        roleError = e;
      }

      if (requestId !== profileRequestId.current) return;
      if (profileError) throw profileError;
      if (userProfileError) throw userProfileError;
      if (roleError) throw roleError;
      if (!p) throw new Error("Profilo utente non trovato");
      const displayName = (up as any)?.display_name || p.full_name;
      const userLang: "it" | "en" = (up as any)?.language === "en" ? "en" : "it";
      void i18n.changeLanguage(userLang);

      setProfile({
        id: p.id,
        full_name: displayName,
        initials: p.initials || displayName.slice(0, 2).toUpperCase(),
        avatar_url: (up as any)?.avatar_url ?? null,
        password_set: (up as any)?.password_set ?? true,
        role: (r?.role as AppRole) ?? "viewer",
        language: userLang,
      });
    } catch (err: unknown) {
      if (requestId !== profileRequestId.current) return;
      setProfile(null);
      setAuthError(errorMessage(err, "Impossibile caricare il profilo utente"));
    } finally {
      if (requestId === profileRequestId.current) setProfileLoading(false);
    }
  }, [getRole]);

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

      await loadProfile(s.user.id, s?.access_token ?? null);
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
      if (user) await loadProfile(user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
