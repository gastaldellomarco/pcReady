import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "tech" | "viewer";

export interface AuthProfile {
  id: string;
  full_name: string;
  initials: string;
  avatar_url: string | null;
  password_set: boolean;
  role: AppRole;
  language: "it" | "en";
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

export const Ctx = createContext<AuthCtx | undefined>(undefined);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
