import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { TurnstileWidget, isCaptchaEnabled } from '../components/auth/TurnstileWidget';
import { Alert, Button, Card, Input, ProgressBar } from '../components/ui';
import type { ProgressTone } from '../components/ui';
import { PLAN_DETAILS } from '../config/subscriptionPlans';
import { planParamToTier, setPendingPlan } from '../services/pendingPlan';
import { notifyWelcome } from '../services/api/welcome';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** Derive initials from a full name (up to 3 chars). */
const deriveInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Password strength: 0-4. Mirrors the backend policy in supabase/config.toml
 * (minimum_password_length = 10, password_requirements = "lower_upper_letters_digits"):
 * one point each for length ≥ 10, a lowercase letter, an uppercase letter, and a digit.
 */
const getPasswordStrength = (pw: string): number => {
    let score = 0;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    return score;
};

const STRENGTH_LABELS = ['For kort', 'Svag', 'Middel', 'God', 'Stærk'];
const STRENGTH_TONES: ProgressTone[] = ['danger', 'danger', 'warning', 'success', 'success'];
const STRENGTH_TEXT = [
    'text-danger-strong dark:text-danger',
    'text-danger-strong dark:text-danger',
    'text-warning-strong dark:text-warning',
    'text-success-strong dark:text-success',
    'text-success-strong dark:text-success',
];

// ─── Email Confirmation Screen ────────────────────────────────────────────────
const EmailConfirmationScreen: React.FC<{ email: string }> = ({ email }) => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex flex-col justify-center items-center px-4 py-8 pt-safe pb-safe">
            <div className="w-full max-w-md text-center">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="bg-brand-primary text-white p-3 rounded-card shadow-card">
                        <ByggeAppLogoIcon />
                    </div>
                    <span className="text-title text-text-primary dark:text-text-dark-primary tracking-wide">BYG SMART</span>
                </div>
                <Card padding="lg">
                    <div className="w-16 h-16 bg-brand-subtle dark:bg-brand-subtle-dark rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                    </div>
                    <h1 className="text-title text-text-primary dark:text-text-dark-primary mb-2">Bekræft din e-mail</h1>
                    <p className="text-body text-text-secondary dark:text-text-dark-secondary mb-1">Vi har sendt et bekræftelseslink til:</p>
                    <p className="text-body font-semibold text-brand-primary mb-4 break-all">{email}</p>
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary mb-6">
                        Tjek din indbakke (og spam-mappen) og klik på linket for at aktivere din konto.
                    </p>
                    <Button size="lg" fullWidth onClick={() => navigate('/login')}>
                        Gå til Log ind
                    </Button>
                </Card>
                <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary mt-4">
                    Modtog du ikke e-mailen?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="inline-flex items-center justify-center min-h-11 px-1 align-middle font-semibold text-brand-primary hover:underline"
                    >
                        Prøv igen
                    </button>
                </p>
            </div>
        </div>
    );
};

// ─── Register Form ────────────────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
    const [name, setName] = useState('');
    const [initials, setInitials] = useState('');
    const [initialsManuallyEdited, setInitialsManuallyEdited] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
    const [captchaToken, setCaptchaToken] = useState('');
    // Plan chosen on the marketing site (…/#/register?plan=mester). Persisted so
    // the subscription chooser can open on it after the email-confirmation step.
    const [planTier, setPlanTier] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { register } = useAuth();

    const passwordStrength = getPasswordStrength(password);

    useEffect(() => {
        const tier = planParamToTier(new URLSearchParams(location.search).get('plan'));
        if (tier) {
            setPlanTier(tier);
            setPendingPlan(tier);
        }
    }, [location.search]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setName(val);
        // Auto-generate initials unless the user has manually edited them
        if (!initialsManuallyEdited) {
            setInitials(deriveInitials(val));
        }
    };

    const handleInitialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInitials(e.target.value.toUpperCase());
        setInitialsManuallyEdited(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate email
        if (!EMAIL_REGEX.test(email)) {
            setError('Indtast en gyldig e-mailadresse.');
            return;
        }
        // Validate username
        if (!USERNAME_REGEX.test(username)) {
            setError('Brugernavnet må kun indeholde bogstaver, tal og underscore (3–30 tegn).');
            return;
        }
        // Validate initials
        const trimmedInitials = initials.trim();
        if (trimmedInitials.length === 0 || trimmedInitials.length > 3) {
            setError('Initialer skal være mellem 1 og 3 tegn.');
            return;
        }
        // Validate password strength — must match supabase/config.toml
        // (minimum_password_length = 10, password_requirements = "lower_upper_letters_digits").
        if (password.length < 10) {
            setError('Adgangskoden skal være mindst 10 tegn.');
            return;
        }
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Adgangskoden skal indeholde små og store bogstaver samt tal.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Adgangskoderne er ikke ens.');
            return;
        }
        // Require a solved CAPTCHA when the gate is active (F-05)
        if (isCaptchaEnabled && !captchaToken) {
            setError('Bekræft venligst, at du ikke er en robot.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await register({
                email,
                password,
                username,
                name: name.trim(),
                initials: trimmedInitials.toUpperCase(),
                captchaToken: captchaToken || undefined,
            });

            if (result.success) {
                if (result.requiresConfirmation) {
                    // Show inline confirmation screen — do NOT navigate to /home.
                    // A chosen plan stays in localStorage and is picked up after login.
                    setConfirmedEmail(email);
                } else {
                    // Immediate login (no email confirmation): send plan-driven
                    // signups to Settings so the subscription chooser can open.
                    notifyWelcome(); // fire-and-forget; server sends welcome once
                    navigate(planTier ? '/settings' : '/home');
                }
            } else {
                setError(result.message || 'Der opstod en fejl ved oprettelse.');
            }
        } catch (err) {
            setError('Der opstod en fejl. Prøv igen.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Show confirmation screen after successful signup with email confirmation
    if (confirmedEmail) {
        return <EmailConfirmationScreen email={confirmedEmail} />;
    }

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
                    <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">Opret Konto</h1>
                    <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-6">Kom i gang med BYG SMART.</p>
                    {planTier && PLAN_DETAILS[planTier as keyof typeof PLAN_DETAILS] && (
                        <div className="mb-6 rounded-control bg-brand-subtle dark:bg-brand-subtle-dark px-4 py-3 text-center">
                            <p className="text-label text-brand-primary font-semibold">
                                Valgt plan: {PLAN_DETAILS[planTier as keyof typeof PLAN_DETAILS].label}
                            </p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                                Du kan aktivere abonnementet, når din konto er oprettet.
                            </p>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name */}
                        <Input
                            id="register-name"
                            type="text"
                            label="Fulde Navn"
                            value={name}
                            onChange={handleNameChange}
                            required
                            autoComplete="name"
                            placeholder="F.eks. Mads Hansen"
                            title="Fulde Navn"
                        />

                        {/* Initials — auto-filled, but editable */}
                        <Input
                            id="register-initials"
                            type="text"
                            label="Initialer (maks. 3)"
                            hint="Udfyldes automatisk ud fra dit navn"
                            value={initials}
                            onChange={handleInitialsChange}
                            required
                            maxLength={3}
                            placeholder="F.eks. MH"
                            title="Initialer"
                            className="uppercase tracking-widest"
                        />

                        {/* Username */}
                        <Input
                            id="register-username"
                            type="text"
                            label="Brugernavn"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            required
                            autoComplete="username"
                            placeholder="Dit unikke brugernavn (kun a-z, 0-9, _)"
                            title="Brugernavn"
                        />

                        {/* Email */}
                        <Input
                            id="register-email"
                            type="email"
                            label="E-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            placeholder="din@email.dk"
                            title="E-mail"
                        />

                        {/* Password */}
                        <div>
                            <Input
                                id="register-password"
                                type="password"
                                label="Adgangskode"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                placeholder="Mindst 10 tegn, små/store bogstaver og tal"
                                title="Adgangskode"
                            />
                            {/* Password strength indicator */}
                            {password.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    <ProgressBar
                                        value={(passwordStrength / 4) * 100}
                                        tone={STRENGTH_TONES[passwordStrength]}
                                        size="sm"
                                        label={`Kodeordsstyrke: ${STRENGTH_LABELS[passwordStrength]}`}
                                    />
                                    <p className={`text-caption font-semibold ${STRENGTH_TEXT[passwordStrength]}`}>
                                        {STRENGTH_LABELS[passwordStrength]}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <Input
                            id="register-confirm-password"
                            type="password"
                            label="Bekræft Adgangskode"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                            placeholder="Gentag adgangskode"
                            title="Bekræft Adgangskode"
                            error={confirmPassword.length > 0 && password !== confirmPassword ? 'Adgangskoderne er ikke ens.' : undefined}
                        />

                        {/* CAPTCHA (F-05) — only renders when VITE_TURNSTILE_SITE_KEY is set */}
                        {isCaptchaEnabled && (
                            <div className="flex justify-center rounded-control overflow-hidden">
                                <TurnstileWidget
                                    onVerify={setCaptchaToken}
                                    onExpire={() => setCaptchaToken('')}
                                />
                            </div>
                        )}

                        {error && <Alert variant="danger">{error}</Alert>}

                        <Button type="submit" size="lg" fullWidth loading={isLoading}>
                            {isLoading ? 'Opretter...' : 'Opret Konto'}
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary mt-6">
                    Har du allerede en konto?{' '}
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center min-h-11 px-1 align-middle font-semibold text-brand-primary hover:underline"
                    >
                        Log ind her
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;
