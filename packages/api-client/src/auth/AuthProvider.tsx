// AuthProvider + useSession — the app's identity layer, adapted from the 2.1 production
// AuthProvider (Supabase email/password → session). The Supabase client is injected
// (created by the app with a platform storage adapter), so screens and the sync layer
// depend on this hook, never on a hard-wired client. MFA (aal1→aal2 TOTP) is enforced in
// 2.1 and is the next increment; the seam is `mfaRequired` on the login result.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { loginErrorMessage } from './messages';

export interface LoginResult {
  success: boolean;
  message: string;
  /** True when the password was accepted but a TOTP second factor is still required. */
  mfaRequired?: boolean;
}

export interface AuthValue {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  /** True until the initial persisted-session check completes. */
  isLoading: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  /** Current access token, refreshed as needed — the sync layer calls this per request. */
  getToken(): Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useSession(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useSession must be used within an AuthProvider');
  return v;
}

export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Restore a persisted session on mount, then follow all auth changes (login,
    // token refresh, logout) through onAuthStateChange.
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, message: loginErrorMessage(error.message) };
    setSession(data.session);
    return { success: true, message: 'Logget ind.' };
  };

  const logout = async (): Promise<void> => {
    await client.auth.signOut();
    setSession(null);
  };

  const getToken = async (): Promise<string | null> => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    login,
    logout,
    getToken,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
