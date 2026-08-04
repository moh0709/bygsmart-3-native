import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import type { Database } from '../services/database.types';
import {
    findProfileByUsername,
    isSupabaseDuplicateSignupResponse,
} from './authProfileQueries';
import { buildBaseRedirectUrl, buildHashRouteRedirectUrl } from './authRedirect';
import { maxSubscriptionTier } from '../config/subscriptionPlans';

// ============================================================
// Auth Context Types
// ============================================================
interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    /**
     * True when the current session is authenticated with a password (aal1) but
     * the account has a verified TOTP factor and must still pass the second-factor
     * challenge (aal2) before it is treated as logged in. While true the app must
     * render the MFA challenge screen instead of protected content.
     */
    mfaPending: boolean;
    login: (email: string, password: string, captchaToken?: string) => Promise<{ success: boolean; message: string; mfaRequired?: boolean }>;
    /** Completes the second-factor step for a session that is pending MFA. */
    verifyLoginMfa: (code: string) => Promise<{ success: boolean; message: string }>;
    /** Abandons a pending MFA challenge and signs the half-authenticated session out. */
    cancelMfa: () => Promise<void>;
    logout: () => Promise<void>;
    register: (userData: {
        email: string;
        password: string;
        username: string;
        name: string;
        initials: string;
        captchaToken?: string;
    }) => Promise<{ success: boolean; message: string; requiresConfirmation?: boolean }>;
    updateUser: (data: Partial<User>) => Promise<void>;
    resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
    deleteAccount: () => Promise<{ success: boolean; message: string }>;
    demoLogin: (contactEmail: string, captchaToken?: string) => Promise<{ success: boolean; message: string; userId?: string; needsProfile?: boolean }>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// Helper: Map Supabase profile row → app User type
// ============================================================
type ProfileRow = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'username' | 'name' | 'initials' | 'email' | 'subscription_tier' | 'is_demo' | 'demo_contact_email' | 'app_role'
> & {
    job_title?: string | null;
    cvr?: string | null;
    address?: string | null;
    phone?: string | null;
    team_id?: string | null;
    team_role?: string | null;
    created_at?: string | null;
    company_name?: string | null;
    trial_tier?: string | null;
    trial_ends_at?: string | null;
};
const PROFILE_COLUMNS = 'id, username, name, initials, email, subscription_tier, is_demo, demo_contact_email, app_role, job_title, cvr, address, phone, team_id, team_role, created_at, company_name, trial_tier, trial_ends_at';

const mapProfileToUser = (profile: ProfileRow): User => {
    const baseTier = (profile.subscription_tier ?? 'FREE') as import('../types').SubscriptionTier;
    const isTrialActive = !!profile.trial_tier && !!profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();
    // Admin-granted trial (see PATCH /api/admin/users/:id/trial) overlays the
    // real, Stripe-verified tier while active — never replaces it in the DB.
    const effectiveTier = isTrialActive
        ? maxSubscriptionTier(baseTier, profile.trial_tier as import('../types').SubscriptionTier)
        : baseTier;

    return {
        id: profile.id,
        username: profile.username,
        name: profile.name || profile.username,
        initials: profile.initials || profile.name?.substring(0, 2).toUpperCase() || 'XX',
        email: profile.email ?? undefined,
        subscriptionTier: effectiveTier,
        isDemo: profile.is_demo ?? false,
        demoContactEmail: profile.demo_contact_email ?? undefined,
        appRole: (profile.app_role === 'admin' ? 'admin' : 'user') as import('../types').AppRole,
        companyName: profile.company_name ?? null,
        jobTitle: (profile.job_title as import('../types').JobTitle) ?? null,
        cvr: profile.cvr ?? null,
        address: profile.address ?? null,
        phone: profile.phone ?? null,
        teamId: profile.team_id ?? null,
        teamRole: (profile.team_role as import('../types').TeamRole) ?? null,
        createdAt: profile.created_at ?? null,
        isTrialActive,
        trialEndsAt: isTrialActive ? profile.trial_ends_at ?? null : null,
    };
};

// ============================================================
// Auth Provider Component
// ============================================================
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mfaPending, setMfaPending] = useState(false);

    // Load user profile from Supabase when session changes
    const loadUserProfile = useCallback(async (userId: string) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select(PROFILE_COLUMNS)
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('[Auth] Failed to load profile:', error.message);
                return null;
            }

            return profile ? mapProfileToUser(profile as unknown as ProfileRow) : null;
        } catch (err) {
            console.error('[Auth] Profile load exception:', err);
            return null;
        }
    }, []);

    // ============================================================
    // Central session gate — the ONLY place that promotes a session to a
    // logged-in user. If the account has a verified TOTP factor and the session
    // has not yet reached aal2, the user is held in a "pending MFA" state
    // (user stays null, mfaPending=true) so the app renders the challenge screen
    // instead of protected content. Every entry point (initial load,
    // onAuthStateChange, explicit login) funnels through here so the second
    // factor cannot be bypassed by any single code path.
    // Returns 'authenticated' | 'mfa' | 'none'.
    // ============================================================
    const applySession = useCallback(async (activeSession: Session | null): Promise<'authenticated' | 'mfa' | 'none'> => {
        if (!activeSession?.user) {
            setUser(null);
            setMfaPending(false);
            return 'none';
        }

        try {
            const { data: aal, error: aalError } =
                await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            // nextLevel === 'aal2' means a verified factor exists; currentLevel is
            // still 'aal1' until a challenge is passed. Only gate when we can
            // positively confirm a step-up is required — if the AAL lookup fails
            // we fall through and load the profile so a transient error can never
            // lock a user out of an account that has no MFA configured.
            if (!aalError && aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
                setUser(null);
                setMfaPending(true);
                return 'mfa';
            }
        } catch (err) {
            console.error('[Auth] AAL check failed:', err);
        }

        const profile = await loadUserProfile(activeSession.user.id);
        setUser(profile);
        setMfaPending(false);
        return 'authenticated';
    }, [loadUserProfile]);

    // Single consolidated auth effect — always reaches setIsLoading(false) via finally.
    useEffect(() => {
        if (!isSupabaseConfigured) {
            setUser(null);
            setSession(null);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let initialised = false;
        let safetyTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (isMounted && !initialised) {
                console.warn('[Auth] Safety timeout: forcing isLoading=false after 10s');
                setIsLoading(false);
            }
        }, 10_000);

        const init = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                if (!isMounted) return;
                setSession(initialSession);
                await applySession(initialSession);
            } catch (err) {
                console.error('[Auth] Failed to get initial session:', err);
                if (isMounted) {
                    setUser(null);
                    setSession(null);
                }
            } finally {
                if (isMounted) {
                    initialised = true;
                    setIsLoading(false);
                    if (safetyTimer) {
                        clearTimeout(safetyTimer);
                        safetyTimer = null;
                    }
                }
            }
        };

        init();

        // Profile loading must never run inside the onAuthStateChange callback because
        // Supabase holds internal auth locks while the callback executes. Awaiting
        // supabase.from() here would deadlock. Instead we capture the session synchronously
        // and defer the profile fetch to a separate async resolver via setTimeout.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!isMounted) return;
            setSession(newSession);

            // Ignore events fired before the initial getSession() has resolved
            if (!initialised) return;

            if (newSession?.user) {
                setIsLoading(true);
                // Defer outside the callback so Supabase auth internals are no longer active
                setTimeout(async () => {
                    if (!isMounted) return;
                    try {
                        await applySession(newSession);
                    } finally {
                        if (isMounted) setIsLoading(false);
                    }
                }, 0);
            } else {
                setUser(null);
                setMfaPending(false);
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
            if (safetyTimer) clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, [loadUserProfile]);

    // ============================================================
    // Login — uses Supabase Auth email/password
    // ============================================================
    const login = async (
        emailOrUsername: string,
        password: string,
        captchaToken?: string
    ): Promise<{ success: boolean; message: string; mfaRequired?: boolean }> => {
        try {
            // Determine if input is email or username
            let email = emailOrUsername;

            if (!emailOrUsername.includes('@')) {
                // It's a username — look up the email from profiles
                const { data: profileData, error: profileError } =
                    await findProfileByUsername<{ email: string | null }>(
                        supabase,
                        emailOrUsername,
                        'email'
                    );

                if (profileError || !profileData?.email) {
                    return { success: false, message: 'Brugernavn ikke fundet.' };
                }
                email = profileData.email;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
                ...(captchaToken ? { options: { captchaToken } } : {}),
            });

            if (error) {
                console.error('[Auth] Login error:', error.message);
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, message: 'Forkert e-mail eller adgangskode.' };
                }
                if (error.message.includes('Email not confirmed')) {
                    return {
                        success: false,
                        message: 'Din e-mail er ikke bekræftet. Tjek din indbakke.',
                    };
                }
                return { success: false, message: error.message };
            }

            if (data.session?.user) {
                setSession(data.session);
                setIsLoading(true);
                const outcome = await applySession(data.session);
                setIsLoading(false);

                if (outcome === 'mfa') {
                    // Password accepted, but the account has a verified TOTP factor.
                    // Hold here until the second factor is verified — the app renders
                    // the MFA challenge screen while mfaPending is true.
                    return {
                        success: false,
                        mfaRequired: true,
                        message: 'Indtast koden fra din authenticator-app for at fuldføre login.',
                    };
                }

                if (outcome === 'none') {
                    return {
                        success: false,
                        message: 'Login lykkedes, men din profil kunne ikke indlæses. Prøv at opdatere siden.',
                    };
                }
            }

            return { success: true, message: 'Logget ind!' };
        } catch (err) {
            console.error('[Auth] Login exception:', err);
            return { success: false, message: 'En uventet fejl opstod. Prøv igen.' };
        }
    };

    // ============================================================
    // Verify the second factor for a session that is pending MFA (aal1 → aal2).
    // Called by the MFA challenge screen with the 6-digit code from the user's
    // authenticator app. On success the session JWT is upgraded to aal2 and the
    // profile is loaded, completing login.
    // ============================================================
    const verifyLoginMfa = async (
        code: string
    ): Promise<{ success: boolean; message: string }> => {
        const trimmed = (code || '').trim();
        if (!/^\d{6}$/.test(trimmed)) {
            return { success: false, message: 'Indtast den 6-cifrede kode fra din authenticator-app.' };
        }

        try {
            const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
            if (listErr) {
                return { success: false, message: listErr.message };
            }
            const totp = factors?.totp?.find((f) => f.status === 'verified');
            if (!totp) {
                return { success: false, message: 'Ingen aktiv to-faktor-enhed blev fundet.' };
            }

            const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
                factorId: totp.id,
            });
            if (challengeErr || !challenge) {
                return {
                    success: false,
                    message: challengeErr?.message ?? 'Kunne ikke oprette to-faktor-udfordring.',
                };
            }

            const { error: verifyErr } = await supabase.auth.mfa.verify({
                factorId: totp.id,
                challengeId: challenge.id,
                code: trimmed,
            });
            if (verifyErr) {
                return { success: false, message: 'Forkert kode. Prøv igen.' };
            }

            // Session is now aal2 — re-read it and complete the login.
            const { data: { session: upgraded } } = await supabase.auth.getSession();
            setSession(upgraded);
            setIsLoading(true);
            await applySession(upgraded);
            setIsLoading(false);

            return { success: true, message: 'Godkendt.' };
        } catch (err) {
            console.error('[Auth] verifyLoginMfa exception:', err);
            return { success: false, message: 'To-faktor-verifikation mislykkedes. Prøv igen.' };
        }
    };

    // Abandon a pending MFA challenge: sign the half-authenticated (aal1) session
    // out and return to a clean logged-out state.
    const cancelMfa = async (): Promise<void> => {
        await supabase.auth.signOut().catch(() => undefined);
        setUser(null);
        setSession(null);
        setMfaPending(false);
    };

    // ============================================================
    // Register — creates Supabase Auth user + profile row
    // ============================================================
    const register = async (userData: {
        email: string;
        password: string;
        username: string;
        name: string;
        initials: string;
        captchaToken?: string;
    }): Promise<{ success: boolean; message: string; requiresConfirmation?: boolean }> => {
        try {
            // Convert existing demo account to real account if one exists for this
            // email. The server requires us to be signed in AS the demo user, so we
            // attach the current session token when one exists.
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                const claimHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                if (currentSession?.access_token) {
                    claimHeaders.Authorization = `Bearer ${currentSession.access_token}`;
                }
                const claimRes = await fetch('/api/claim-demo-account', {
                    method: 'POST',
                    headers: claimHeaders,
                    body: JSON.stringify(userData),
                });
                const claimData = (await claimRes.json().catch(() => ({}))) as { claimed?: boolean };
                if (claimRes.ok && claimData.claimed) {
                    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
                        email: userData.email,
                        password: userData.password,
                    });
                    if (signInErr) return { success: false, message: signInErr.message };
                    if (!signInData.user) return { success: false, message: 'Login fejlede efter kontokonvertering.' };
                    return { success: true, message: 'Konto oprettet!', requiresConfirmation: false };
                }
            } catch {
                // Network failure — fall through to normal signUp
            }

            // Check if username is already taken
            const { data: existingProfile } = await findProfileByUsername<{ id: string }>(
                supabase,
                userData.username,
                'id'
            );

            if (existingProfile) {
                return { success: false, message: 'Brugernavnet er allerede i brug.' };
            }

            // Create the auth user (triggers handle_new_user() to auto-create profile)
            const { data, error } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    emailRedirectTo: buildBaseRedirectUrl(
                        window.location.origin,
                        import.meta.env.BASE_URL
                    ),
                    // CAPTCHA token (F-05) — required when Supabase CAPTCHA is enabled.
                    ...(userData.captchaToken ? { captchaToken: userData.captchaToken } : {}),
                    data: {
                        // These go into raw_user_meta_data and are picked up by the trigger
                        username: userData.username,
                        name: userData.name,
                        initials: userData.initials,
                    },
                },
            });

            if (error) {
                console.error('[Auth] Register error:', error.message);
                if (error.message.includes('already registered')) {
                    return { success: false, message: 'Denne e-mail er allerede registreret.' };
                }
                return { success: false, message: error.message };
            }

            if (!data.user) {
                return { success: false, message: 'Bruger blev ikke oprettet. Prøv igen.' };
            }

            if (isSupabaseDuplicateSignupResponse(data.user)) {
                return {
                    success: false,
                    message: 'Denne e-mail er allerede registreret. Prøv at logge ind i stedet.',
                };
            }

            // If email confirmation is disabled (for testing), the session is available immediately.
            // If email confirmation is enabled, the user must verify their email first.
            if (data.session) {
                return { success: true, message: 'Konto oprettet og logget ind!', requiresConfirmation: false };
            } else {
                return {
                    success: true,
                    requiresConfirmation: true,
                    message:
                        'Konto oprettet! Tjek din e-mail og bekræft din konto, før du logger ind.',
                };
            }
        } catch (err) {
            console.error('[Auth] Register exception:', err);
            return { success: false, message: 'En uventet fejl opstod ved registrering.' };
        }
    };

    // ============================================================
    // Logout
    // ============================================================
    const logout = async (): Promise<void> => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setMfaPending(false);
    };

    // ============================================================
    // Reset Password
    // ============================================================
    const resetPassword = async (
        email: string
    ): Promise<{ success: boolean; message: string }> => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: buildHashRouteRedirectUrl(
                    window.location.origin,
                    import.meta.env.BASE_URL,
                    '/reset-password'
                ),
            });

            if (error) {
                return { success: false, message: error.message };
            }

            return {
                success: true,
                message: 'Et link til nulstilling af adgangskode er sendt til din e-mail.',
            };
        } catch (err) {
            return { success: false, message: 'Kunne ikke sende nulstillingslink.' };
        }
    };

    // ============================================================
    // Demo Login (for testing/demo purposes)
    // ============================================================
    const demoLogin = async (contactEmail: string, captchaToken?: string): Promise<{ success: boolean; message: string; userId?: string; needsProfile?: boolean }> => {
        try {
            const response = await fetch('/api/demo-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: contactEmail }),
            });

            const payload = (await response.json().catch(() => ({}))) as {
                email?: string;
                password?: string;
                error?: string;
                needsProfile?: boolean;
            };

            // 409 = real account exists for this email — must not fall through to static fallback
            if (response.status === 409) {
                return {
                    success: false,
                    message: payload.error || 'Du har allerede en aktiv konto. Log ind med e-mail og adgangskode.',
                };
            }

            if (!response.ok || !payload.email || !payload.password) {
                // Fallback: use static demo credentials from env vars (local dev without backend)
                const fallbackEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
                const fallbackPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
                if (fallbackEmail && fallbackPassword) {
                    const { data: fbData, error: fbError } = await supabase.auth.signInWithPassword({
                        email: fallbackEmail,
                        password: fallbackPassword,
                    });
                    if (!fbError && fbData.user) {
                        return { success: true, message: 'Demo konto klar!', userId: fbData.user.id };
                    }
                }
                return {
                    success: false,
                    message: payload.error || 'Demo login fejlede. Prøv igen.',
                };
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: payload.email,
                password: payload.password,
                ...(captchaToken ? { options: { captchaToken } } : {}),
            });

            if (error) {
                console.error('[Auth] Demo generated sign-in error:', error.message);
                return { success: false, message: 'Demo login fejlede. Prøv igen.' };
            }

            return {
                success: true,
                message: 'Demo konto klar!',
                userId: data.user?.id,
                needsProfile: payload.needsProfile !== false,
            };

        } catch (err) {
            console.error('[Auth] Demo login exception:', err);
            return { success: false, message: 'Demo login fejlede. Prøv igen.' };
        }
    };

    // ============================================================
    // Update User Profile
    // ============================================================
    const updateUser = async (data: Partial<User>): Promise<void> => {
        if (!user || !session) return;

        try {
            const updateData: Record<string, any> = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.initials !== undefined) updateData.initials = data.initials;
            if (data.username !== undefined) updateData.username = data.username;
            if (data.jobTitle !== undefined) updateData.job_title = data.jobTitle;
            if (data.cvr !== undefined) updateData.cvr = data.cvr;
            if (data.address !== undefined) updateData.address = data.address;
            if (data.phone !== undefined) updateData.phone = data.phone;
            if (data.companyName !== undefined) updateData.company_name = data.companyName;

            const { error } = await supabase
                .from('profiles')
                .update({ ...updateData, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (error) {
                console.error('[Auth] updateUser error:', error.message);
                throw new Error(error.message);
            }

            // Also update email in Supabase Auth if changed
            if (data.email && data.email !== user.email) {
                await supabase.auth.updateUser({ email: data.email });
            }

            // Reload the full profile so trigger-generated fields are reflected
            const refreshed = await loadUserProfile(user.id);
            if (refreshed) setUser(refreshed);
        } catch (err) {
            console.error('[Auth] updateUser exception:', err);
            throw err;
        }
    };

    // ============================================================
    // Delete Account
    // ============================================================
    const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
        try {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
                return { success: false, message: 'Du er ikke logget ind.' };
            }

            const response = await fetch('/api/delete-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({}),
            });

            const payload = (await response.json().catch(() => ({}))) as {
                message?: string;
                error?: string;
            };

            if (!response.ok) {
                return {
                    success: false,
                    message: payload.error || payload.message || 'Kunne ikke slette kontoen.',
                };
            }

            // Ensure local client session is cleared after server-side user deletion.
            await supabase.auth.signOut().catch(() => undefined);
            setUser(null);
            setSession(null);

            return {
                success: true,
                message: payload.message || 'Din konto er slettet.',
            };
        } catch (err) {
            console.error('[Auth] deleteAccount exception:', err);
            return { success: false, message: 'En uventet fejl opstod ved kontosletning.' };
        }
    };

    const refreshUser = useCallback(async (): Promise<void> => {
        const userId = session?.user?.id;
        if (!userId) return;
        const profile = await loadUserProfile(userId);
        if (profile) setUser(profile);
    }, [session?.user?.id, loadUserProfile]);

    const value: AuthContextType = {
        user,
        session,
        isAuthenticated: !!user && !!session,
        isLoading,
        mfaPending,
        login,
        verifyLoginMfa,
        cancelMfa,
        logout,
        register,
        updateUser,
        resetPassword,
        deleteAccount,
        demoLogin,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
