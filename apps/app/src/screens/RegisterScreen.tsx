// Opret konto — email/password + name signup against Supabase (adapted from the 2.1
// register). With email confirmation off the new session lands straight in the app; if a
// project later enables confirmation, requiresConfirmation surfaces a check-your-email
// message. Presentation via AuthScaffold; auth wiring unchanged (AR-05).
import { useState } from 'react';
import { VStack, Text, TextField, Button, Alert } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';
import { AuthScaffold, AuthLink } from './AuthScaffold';

export function RegisterScreen({ onLogin }: { onLogin?: () => void } = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { register } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await register(email, password, name);
    setBusy(false);
    if (!res.success) setError(res.message);
    else if (res.requiresConfirmation) setNotice(res.message); // else: signed in → gate swaps us out
  };

  return (
    <AuthScaffold
      footer={onLogin ? <AuthLink prefix={t('register.haveAccount')} label={t('register.toLogin')} onPress={onLogin} /> : undefined}
    >
      <VStack gap="md">
        <Text variant="title" center>
          {t('register.title')}
        </Text>
        <TextField label={t('register.name')} value={name} onChangeText={setName} editable={!busy} />
        <TextField
          label={t('register.email')}
          value={email}
          onChangeText={setEmail}
          placeholder="dig@firma.dk"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
        />
        <TextField
          label={t('register.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          editable={!busy}
        />
        {error ? <Alert variant="danger" message={error} /> : null}
        {notice ? <Alert variant="success" message={notice} /> : null}
        <Button title={t('register.submit')} size="lg" fullWidth onPress={submit} loading={busy} />
      </VStack>
    </AuthScaffold>
  );
}
