// The pre-auth flow: toggles between Log ind and Opret konto. Rendered by the app-shell
// gate when a backend is configured and there is no session yet. Keeping the toggle here
// (not in the router) means the auth screens stay navigation-agnostic (AR-05).
import { useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';

export function AuthFlow(): React.JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  return mode === 'login' ? (
    <LoginScreen onRegister={() => setMode('register')} />
  ) : (
    <RegisterScreen onLogin={() => setMode('login')} />
  );
}
