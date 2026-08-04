import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { seedDemoDataIfNeeded } from '../utils/demoSeeder';
import { TurnstileWidget, isCaptchaEnabled } from '../components/auth/TurnstileWidget';
import { Alert, Button, Card, Input } from '../components/ui';
import { getPendingPlan } from '../services/pendingPlan';
import { notifyWelcome } from '../services/api/welcome';

const LOCKOUT_AFTER_ATTEMPTS = 9999; // temporarily disabled
const LOCKOUT_DURATION_MS = 30_000;
const FAILED_ATTEMPTS_KEY = 'bygsmart-login-failed-attempts';
const LOCKOUT_UNTIL_KEY = 'bygsmart-login-lockout-until';

const ByggeAppLogoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="30"
    height="30"
    viewBox="0 0 30 30"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');

  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();

  useEffect(() => {
    // clear any active lockout (temporarily disabled)
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  }, []);

  useEffect(() => {
    if (!lockoutUntil) return;

    const timer = window.setInterval(() => {
      const msLeft = lockoutUntil - Date.now();
      if (msLeft <= 0) {
        setLockoutUntil(null);
        setRemainingSeconds(0);
        setFailedAttempts(0);
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_UNTIL_KEY);
        return;
      }
      setRemainingSeconds(Math.ceil(msLeft / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [lockoutUntil]);

  const registerFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(nextAttempts));

    if (nextAttempts >= LOCKOUT_AFTER_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_DURATION_MS;
      setLockoutUntil(until);
      setRemainingSeconds(Math.ceil(LOCKOUT_DURATION_MS / 1000));
      localStorage.setItem(LOCKOUT_UNTIL_KEY, String(until));
      setError('For mange mislykkede forsøg. Prøv igen om 30 sekunder.');
    }
  };

  const clearAuthLockout = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    setRemainingSeconds(0);
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  };

  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    const contactEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('Indtast din e-mail ovenfor for at starte demoen.');
      return;
    }
    if (isCaptchaEnabled && !captchaToken) {
      setError('Bekræft venligst, at du ikke er en robot.');
      return;
    }

    setDemoLoading(true);
    setError('');

    try {
      const result = await demoLogin(contactEmail, captchaToken || undefined);
      if (result.success) {
        // A fresh demo account has no identity yet — the welcome step collects
        // name and company before the dashboard. Returning demo visitors who
        // already gave them go straight to /home.
        navigate(result.needsProfile === false ? '/home' : '/demo-velkommen');
        if (result.userId) {
          seedDemoDataIfNeeded(result.userId).catch((seedError) => {
            console.error('[LoginPage] Demo seed failed:', seedError);
          });
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Demo login fejlede. Prøv igen.');
      console.error(err);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockoutUntil && lockoutUntil > Date.now()) {
      setError(`Login er midlertidigt låst. Vent ${remainingSeconds} sekunder.`);
      return;
    }
    if (isCaptchaEnabled && !captchaToken) {
      setError('Bekræft venligst, at du ikke er en robot.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password, captchaToken || undefined);
      if (result.success) {
        clearAuthLockout();
        notifyWelcome(); // fire-and-forget; server sends the welcome email once
        // A plan chosen during signup routes to Settings so the subscription
        // chooser can open on it; everyone else goes to the dashboard.
        navigate(getPendingPlan() ? '/settings' : '/home');
      } else if (result.mfaRequired) {
        // Password was correct — the global MFA challenge screen now takes over
        // (AuthProvider.mfaPending). Not a failed attempt; clear the counter.
        clearAuthLockout();
      } else {
        registerFailedAttempt();
        setError(result.message || 'Ugyldigt brugernavn eller adgangskode.');
      }
    } catch (err) {
      registerFailedAttempt();
      setError('Der opstod en fejl. Prøv igen.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = Boolean(lockoutUntil && lockoutUntil > Date.now());

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
          <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">Log ind</h1>
          <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-1">Velkommen tilbage!</p>
          <p className="text-label text-center text-text-secondary dark:text-text-dark-secondary mb-6">
            Indtast din e-mail og klik "Demo adgang" for at se demoen.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-identifier"
              type="text"
              label="E-mail eller brugernavn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="din@email.dk"
              title="E-mail eller brugernavn"
            />
            <Input
              id="login-password"
              type="password"
              label="Adgangskode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Din adgangskode"
              title="Adgangskode"
            />
            {isLocked && (
              <Alert variant="warning">
                Midlertidig lås aktiv. Prøv igen om {remainingSeconds} sekunder.
              </Alert>
            )}
            {error && <Alert variant="danger">{error}</Alert>}
            {/* CAPTCHA (F-05) — only renders when VITE_TURNSTILE_SITE_KEY is set */}
            {isCaptchaEnabled && (
              <div className="flex justify-center rounded-control overflow-hidden">
                <TurnstileWidget
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                />
              </div>
            )}
            <Button type="submit" size="lg" fullWidth loading={isLoading} disabled={isLocked}>
              {isLoading ? 'Logger ind...' : isLocked ? `Låst (${remainingSeconds}s)` : 'Log ind'}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            className="mt-3"
            onClick={handleDemoLogin}
            loading={demoLoading}
          >
            {demoLoading ? 'Opretter frisk demo...' : 'Demo adgang'}
          </Button>
          <div className="mt-4 text-center">
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center min-h-11 px-2 text-label font-semibold text-brand-primary hover:underline"
            >
              Glemt adgangskode?
            </Link>
          </div>
        </Card>

        <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary mt-6">
          Har du ikke en konto?{' '}
          <Link
            to="/register"
            className="inline-flex items-center justify-center min-h-11 px-1 align-middle font-semibold text-brand-primary hover:underline"
          >
            Opret her
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
