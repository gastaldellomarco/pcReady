import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'tech' | 'viewer';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isViewer: boolean;
  isTech: boolean;
  isAdmin: boolean;
  canWrite: boolean;
}