// The pre-auth flow: toggles between Log ind, Opret konto, and Nulstil adgangskode.
// Rendered by the app-shell gate when a backend is configured and there is no session
// yet. Keeping the toggle here (not in the router) means the auth screens stay
// navigation-agnostic (AR-05).
import { useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

export function AuthFlow(): React.JSX.Element {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  if (mode === 'register') return <RegisterScreen onLogin={() => setMode('login')} />;
  if (mode === 'forgot') return <ForgotPasswordScreen onBack={() => setMode('login')} />;
  return <LoginScreen onRegister={() => setMode('register')} onForgot={() => setMode('forgot')} />;
}
