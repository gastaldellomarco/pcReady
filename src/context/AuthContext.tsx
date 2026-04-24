import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getProfile } from '../services/profile.service';
import type { AuthContextValue, Profile } from '../types/auth';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface Props {
  children: ReactNode;
}

// ⚠️ Stato per trackare migrazioni concurrent (fix race condition)
let globalBootstrapPromise: Promise<void> | null = null;

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  
  // Track se l'utente è stato marcato come inattivo
  const [isInactiveFlagged, setIsInactiveFlagged] = useState(false);
  
  // Ref per prevenire multiple concurrent bootstrap
  const bootstrappingRef = useRef(false);
  const inactivityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setIsInactiveFlagged(false);
      return;
    }

    try {
      const profileData = await getProfile(currentUser.id);

      if (!profileData) {
        throw new Error('Profile not found');
      }

      if (!profileData.is_active) {
        // ⚠️ Se utente è inattivo, flaggare e uscire
        setIsInactiveFlagged(true);
        setProfile(null);
        await supabase.auth.signOut();
        throw new Error('Account disattivato. Contatta l\'amministratore.');
      }

      // ✓ Reset flag se utente è attivo di nuovo
      setIsInactiveFlagged(false);
      setProfile(profileData);
    } catch (error) {
      // ⚠️ Se profile load fallisce, non cancellare user/session
      // Solo cancellare profile
      console.error('[AUTH] Profile load failed:', error);
      setProfile(null);
      throw error;
    }
  }, []);

  // ⚠️ FIX race condition: Usare ref per evitare concurrent bootstrap
  const bootstrap = useCallback(async () => {
    if (bootstrappingRef.current) {
      return;
    }

    bootstrappingRef.current = true;
    setLoading(true);

    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      try {
        await loadProfile(currentSession?.user ?? null);
      } catch (err) {
        console.error('[AUTH] Profile bootstrap error:', err);
        setProfile(null);
      }
    } finally {
      setLoading(false);
      setInitialized(true);
      bootstrappingRef.current = false;
    }
  }, [loadProfile]);

  useEffect(() => {
    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      try {
        await loadProfile(nextSession?.user ?? null);
      } catch (err) {
        console.error('[AUTH] State change profile error:', err);
        setProfile(null);
      } finally {
        setLoading(false);
        // ⚠️ SOLO settare initialized = true qui se non lo era ancora
        setInitialized(true);
      }
    });

    // ⚠️ FIX #4: Aggiungere periodic check per rilevare inactivity
    // Ogni 5 minuti, verifica se utente è ancora attivo
    inactivityCheckIntervalRef.current = setInterval(() => {
      if (user && profile) {
        void loadProfile(user);
      }
    }, 5 * 60 * 1000); // 5 minuti

    return () => {
      subscription.unsubscribe();
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
      }
    };
  }, [bootstrap, loadProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setIsInactiveFlagged(false);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
      setUser(data.user);

      try {
        await loadProfile(data.user);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setUser(null);
      setSession(null);
      setProfile(null);
      setIsInactiveFlagged(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await getProfile(user.id);
    setProfile(profileData);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role;

    return {
      user,
      session,
      profile,
      loading,
      initialized,
      signInWithPassword,
      signOut,
      refreshProfile,
      isAuthenticated: !!session?.user && !isInactiveFlagged,
      isViewer: role === 'viewer',
      isTech: role === 'tech',
      isAdmin: role === 'admin',
      canWrite: role === 'admin' || role === 'tech',
    };
  }, [user, session, profile, loading, initialized, isInactiveFlagged, signInWithPassword, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ✅ Hook per usare AuthContext
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  }
  return context;
}