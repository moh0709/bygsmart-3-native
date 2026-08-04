import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Alert, Button, Card, Input, Spinner } from '../components/ui';

const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Establish the recovery session from the reset link.
    //
    // Supabase appends its tokens as a SECOND URL fragment onto our HashRouter
    // route:  /#/reset-password#access_token=...&refresh_token=...&type=recovery
    // Since only the first '#' starts the fragment, supabase-js's
    // detectSessionInUrl reads window.location.hash and can't find access_token
    // behind the second '#'. So we parse the tokens ourselves and set the session
    // explicitly. (onAuthStateChange / getSession are kept as fallbacks for any
    // single-fragment magic-link variant.)
    useEffect(() => {
        let active = true;
        const markReady = () => { if (active) setIsReady(true); };

        const rawHash = window.location.hash.replace(/^#/, '');
        const authFragment = rawHash.includes('#') ? rawHash.slice(rawHash.indexOf('#') + 1) : rawHash;
        const params = new URLSearchParams(authFragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
            supabase.auth
                .setSession({ access_token: accessToken, refresh_token: refreshToken })
                .then(({ error }) => { if (!error) markReady(); });
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') markReady();
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) markReady();
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        if (password !== confirmPassword) {
            setIsError(true);
            setMessage('Adgangskoderne er ikke ens.');
            return;
        }
        if (password.length < 6) {
            setIsError(true);
            setMessage('Adgangskoden skal være mindst 6 tegn.');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
                setIsError(true);
                setMessage(error.message);
            } else {
                setIsError(false);
                setMessage('Din adgangskode er nu opdateret!');
                setTimeout(() => navigate('/home'), 2000);
            }
        } catch {
            setIsError(true);
            setMessage('Der opstod en fejl. Prøv igen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex flex-col justify-center items-center px-4 py-8 pt-safe pb-safe">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="bg-brand-primary text-white p-3 rounded-card shadow-card">
                        <ByggeAppLogoIcon />
                    </div>
                    <span className="text-title text-text-primary dark:text-text-dark-primary tracking-wide">BYG SMART</span>
                </div>

                <Card padding="lg">
                    <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">Ny adgangskode</h1>
                    <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-6">
                        Vælg en ny adgangskode til din konto.
                    </p>

                    {!isReady ? (
                        <div className="text-center py-8">
                            <Spinner className="w-10 h-10 text-brand-primary mx-auto mb-4" />
                            <p className="text-body text-text-secondary dark:text-text-dark-secondary">Verificerer dit nulstillingslink...</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-3">
                                Hvis siden ikke indlæses, kan dit link være udløbet.{' '}
                                <Link
                                    to="/forgot-password"
                                    className="inline-flex items-center justify-center min-h-11 px-1 align-middle font-semibold text-brand-primary hover:underline"
                                >
                                    Anmod om et nyt.
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="password"
                                label="Ny adgangskode"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                placeholder="Mindst 6 tegn"
                            />
                            <Input
                                type="password"
                                label="Bekræft adgangskode"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                placeholder="Gentag adgangskoden"
                            />
                            {message && (
                                <Alert variant={isError ? 'danger' : 'success'}>
                                    {message}
                                    {!isError && (
                                        <div className="mt-1">
                                            <Link to="/login" className="font-semibold text-brand-primary hover:underline">
                                                Gå til log ind
                                            </Link>
                                        </div>
                                    )}
                                </Alert>
                            )}
                            <Button type="submit" size="lg" fullWidth loading={isLoading}>
                                {isLoading ? 'Gemmer...' : 'Gem ny adgangskode'}
                            </Button>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
