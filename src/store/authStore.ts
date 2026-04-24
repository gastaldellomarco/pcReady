import type { Session } from '@supabase/supabase-js';

class AuthStore {
  private session: Session | null = null;
  private loading = true;

  getSession(): Session | null {
    return this.session;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }

  isLoading(): boolean {
    return this.loading;
  }

  setLoading(value: boolean): void {
    this.loading = value;
  }
}

export const authStore = new AuthStore();