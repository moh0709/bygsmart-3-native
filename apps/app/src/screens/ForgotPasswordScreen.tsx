// Nulstil adgangskode — request a password-reset email (adapted from 2.1's
// resetPassword). Sends the recovery link; the set-new-password step happens when the
// user follows that link (or via Skift adgangskode while signed in). Presentation via
// AuthScaffold; auth wiring unchanged (AR-05).
import { useState } from 'react';
import { VStack, Text, TextField, Button, Alert } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';
import { AuthScaffold, AuthLink } from './AuthScaffold';

export function ForgotPasswordScreen({ onBack }: { onBack?: () => void } = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { resetPassword } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await resetPassword(email);
    setBusy(false);
    if (res.success) setNotice(res.message);
    else setError(res.message);
  };

  return (
    <AuthScaffold footer={onBack ? <AuthLink label={t('forgot.back')} onPress={onBack} /> : undefined}>
      <VStack gap="md">
        <VStack gap="xs">
          <Text variant="title" center>
            {t('forgot.title')}
          </Text>
          <Text variant="body" color="textSecondary" center>
            {t('forgot.subtitle')}
          </Text>
        </VStack>
        <TextField
          label={t('forgot.email')}
          value={email}
          onChangeText={setEmail}
          placeholder="dig@firma.dk"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
        />
        {error ? <Alert variant="danger" message={error} /> : null}
        {notice ? <Alert variant="success" message={notice} /> : null}
        <Button title={t('forgot.submit')} size="lg" fullWidth onPress={submit} loading={busy} />
      </VStack>
    </AuthScaffold>
  );
}
