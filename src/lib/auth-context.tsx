import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "tech" | "viewer";

export interface AuthProfile {
  id: string;
  full_name: string;
  initials: string;
  role: AppRole;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  profileLoading: boolean;
  authError: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const profileRequestId = useRef(0);

  const loadProfile = useCallback(async (uid: string) => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    setAuthError(null);

    try {
      const [{ data: p, error: profileError }, { data: r, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, initials").eq("id", uid).maybeSingle(),
        supabase.rpc("get_user_role", { _user_id: uid }),
      ]);

      if (requestId !== profileRequestId.current) return;
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      if (!p) throw new Error("Profilo utente non trovato");

      setProfile({
        id: p.id,
        full_name: p.full_name,
        initials: p.initials || p.full_name.slice(0, 2).toUpperCase(),
        role: (r as AppRole) ?? "viewer",
      });
    } catch (err: any) {
      if (requestId !== profileRequestId.current) return;
      setProfile(null);
      setAuthError(err?.message || "Impossibile caricare il profilo utente");
    } finally {
      if (requestId === profileRequestId.current) setProfileLoading(false);
    }
  }, []);

  const applySession = useCallback(async (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);

    if (!s?.user) {
      profileRequestId.current++;
      setProfile(null);
      setProfileLoading(false);
      setAuthError(null);
      return;
    }

    await loadProfile(s.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s).finally(() => {
        if (active) setLoading(false);
      });
    });

    supabase.auth.getSession()
      .then(({ data: { session: s }, error }) => {
        if (!active) return;
        if (error) throw error;
        return applySession(s);
      })
      .catch((err: any) => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthError(err?.message || "Impossibile verificare la sessione");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      profileRequestId.current++;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const value: AuthCtx = {
    session,
    user,
    profile,
    loading,
    profileLoading,
    authError,
    canEdit: profile?.role === "admin" || profile?.role === "tech",
    isAdmin: profile?.role === "admin",
    refreshProfile: async () => { if (user) await loadProfile(user.id); },
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
