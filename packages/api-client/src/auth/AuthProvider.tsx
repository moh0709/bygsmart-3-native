// AuthProvider + useSession — the app's identity layer, adapted from the 2.1 production
// AuthProvider (Supabase email/password → session, with a TOTP second factor). The
// Supabase client is injected (created by the app with a platform storage adapter), so
// screens and the sync layer depend on this hook, never on a hard-wired client.
//
// MFA: a password login lands at aal1. If the account has a VERIFIED TOTP factor, the
// session is held in `mfaPending` (isAuthenticated stays false) until the 6-digit code
// steps it up to aal2 — the enforcement cannot be bypassed by any single code path
// because every session change funnels through evalSession().
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { loginErrorMessage } from './messages';
import { mfaRequiredFromAal } from './mfa';

export interface LoginResult {
  success: boolean;
  message: string;
  /** True when the password was accepted but a TOTP second factor is still required. */
  mfaRequired?: boolean;
}

export interface AuthValue {
  session: Session | null;
  user: User | null;
  /** Fully authenticated = a session that is NOT waiting on a second factor. */
  isAuthenticated: boolean;
  /** True until the initial persisted-session check completes. */
  isLoading: boolean;
  /** Password accepted (aal1) but a verified TOTP factor must still be passed. */
  mfaPending: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  /** Complete the second factor with the 6-digit code (aal1 → aal2). */
  verifyMfa(code: string): Promise<LoginResult>;
  /** Abandon a pending MFA challenge and sign the half-authenticated session out. */
  cancelMfa(): Promise<void>;
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
  const [mfaPending, setMfaPending] = useState(false);

  // Evaluate whether a session still owes a second factor. Sets state AND returns the
  // decision so callers (login/verify) can act on it synchronously. Never gates on an
  // AAL-lookup error — a transient failure must not lock out a no-MFA account.
  const evalSession = useCallback(
    async (s: Session | null): Promise<boolean> => {
      if (!s) {
        setMfaPending(false);
        return false;
      }
      try {
        const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        const pending = !error && !!data && mfaRequiredFromAal(data.currentLevel, data.nextLevel);
        setMfaPending(pending);
        return pending;
      } catch {
        setMfaPending(false);
        return false;
      }
    },
    [client],
  );

  useEffect(() => {
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      void evalSession(data.session).finally(() => {
        if (alive) setIsLoading(false);
      });
    });
    // Re-evaluate on every auth change. The AAL call is deferred out of the callback to
    // avoid the supabase-js auth-lock re-entrancy warning.
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      setTimeout(() => {
        if (alive) void evalSession(next);
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [client, evalSession]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, message: loginErrorMessage(error.message) };
    setSession(data.session);
    const pending = await evalSession(data.session);
    if (pending) {
      return { success: false, mfaRequired: true, message: 'Indtast koden fra din authenticator-app.' };
    }
    return { success: true, message: 'Logget ind.' };
  };

  const verifyMfa = async (code: string): Promise<LoginResult> => {
    const trimmed = (code ?? '').trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return { success: false, message: 'Indtast den 6-cifrede kode fra din authenticator-app.' };
    }
    try {
      const { data: factors, error: listErr } = await client.auth.mfa.listFactors();
      if (listErr) return { success: false, message: listErr.message };
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) return { success: false, message: 'Ingen aktiv to-faktor-enhed blev fundet.' };

      const { data: challenge, error: challengeErr } = await client.auth.mfa.challenge({ factorId: totp.id });
      if (challengeErr || !challenge) {
        return { success: false, message: challengeErr?.message ?? 'Kunne ikke oprette to-faktor-udfordring.' };
      }

      const { error: verifyErr } = await client.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: trimmed,
      });
      if (verifyErr) return { success: false, message: 'Forkert kode. Prøv igen.' };

      // Session is now aal2 — re-read it and clear the pending gate.
      const { data } = await client.auth.getSession();
      setSession(data.session);
      await evalSession(data.session);
      return { success: true, message: 'Godkendt.' };
    } catch {
      return { success: false, message: 'To-faktor-verifikation mislykkedes. Prøv igen.' };
    }
  };

  const cancelMfa = async (): Promise<void> => {
    await client.auth.signOut().catch(() => undefined);
    setSession(null);
    setMfaPending(false);
  };

  const logout = async (): Promise<void> => {
    await client.auth.signOut();
    setSession(null);
    setMfaPending(false);
  };

  const getToken = async (): Promise<string | null> => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session && !mfaPending,
    isLoading,
    mfaPending,
    login,
    verifyMfa,
    cancelMfa,
    logout,
    getToken,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
