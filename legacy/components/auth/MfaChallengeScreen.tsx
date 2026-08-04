import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { Alert, Button, Card, Input } from '../ui';

/**
 * Second-factor (TOTP) challenge shown after a correct password when the account
 * has a verified authenticator factor. The session is authenticated at aal1 but
 * is NOT treated as logged in (protected routes stay blocked) until the 6-digit
 * code upgrades it to aal2. Rendered globally by AppRouter while
 * `mfaPending` is true, so it also covers a page refresh mid-challenge.
 */
const MfaChallengeScreen: React.FC = () => {
  const { verifyLoginMfa, cancelMfa } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Indtast den 6-cifrede kode fra din authenticator-app.');
      return;
    }
    setIsVerifying(true);
    try {
      const result = await verifyLoginMfa(code);
      if (result.success) {
        // Session is now aal2 and the user is loaded. The current route is still
        // /login (which renders the login form), so navigate into the app —
        // mirrors what LoginPage does after a non-MFA login.
        navigate('/home', { replace: true });
      } else {
        setError(result.message);
        setCode('');
      }
    } catch {
      setError('To-faktor-verifikation mislykkedes. Prøv igen.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex flex-col justify-center items-center px-4 py-8 pt-safe pb-safe">
      <div className="w-full max-w-md">
        <Card padding="lg">
          <h1 className="text-title text-center text-text-primary dark:text-text-dark-primary mb-1">
            To-faktor-godkendelse
          </h1>
          <p className="text-body text-center text-text-secondary dark:text-text-dark-secondary mb-6">
            Åbn din authenticator-app (Google Authenticator, Microsoft Authenticator, 1Password mv.)
            og indtast den 6-cifrede engangskode.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="mfa-login-code"
              label="6-cifret kode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              required
            />
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" size="lg" fullWidth loading={isVerifying} disabled={code.length !== 6}>
              {isVerifying ? 'Bekræfter…' : 'Bekræft'}
            </Button>
          </form>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            className="mt-3"
            onClick={() => {
              void cancelMfa();
            }}
          >
            Annullér og log ud
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default MfaChallengeScreen;
