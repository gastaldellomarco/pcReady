import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Application roles (fixed, non-configurable).
 */
export type AppRole = "admin" | "tech" | "viewer";

/**
 * Granular permissions assignable to roles.
 * Admins always have all permissions implicitly.
 */
export const ALL_PERMISSIONS = [
  "can_view_costs",
  "can_manage_costs",
  "can_archive_tickets",
  "can_manage_users",
  "can_manage_automations",
  "can_manage_oauth",
  "can_export_data",
  "can_manage_settings",
  "can_view_audit_log",
  "can_manage_bundles",
  "can_delete_devices",
  "can_manage_checklist_templates",
] as const;

/**
 *
 */
export type Permission = (typeof ALL_PERMISSIONS)[number];

/**
 *
 */
export interface AuthProfile {
  id: string;
  full_name: string;
  initials: string;
  avatar_url: string | null;
  password_set: boolean;
  role: AppRole;
  language: "it" | "en";
  permissions: string[];
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
  hasPermission: (permission: string) => boolean;
  isImpersonating: boolean;
  impersonatingTargetId: string | null;
  startImpersonation: (targetUserId: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const Ctx = createContext<AuthCtx | undefined>(undefined);

/**
 *
 */
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
