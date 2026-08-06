// To-faktor-godkendelse — the login-time TOTP challenge (aal1 → aal2). Shown by the
// app-shell gate when a signed-in session still owes its second factor. Enter the
// 6-digit code → verifyMfa; Annuller signs the half-authenticated session out.
// Presentation via AuthScaffold; auth wiring unchanged (AR-05).
import { useState } from 'react';
import { VStack, Text, TextField, Button, Alert } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';
import { AuthScaffold } from './AuthScaffold';

export function MfaChallengeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { verifyMfa, cancelMfa } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await verifyMfa(code);
    setBusy(false);
    if (!res.success) setError(res.message);
  };

  return (
    <AuthScaffold>
      <VStack gap="md">
        <VStack gap="xs">
          <Text variant="title" center>
            {t('mfa.title')}
          </Text>
          <Text variant="body" color="textSecondary" center>
            {t('mfa.subtitle')}
          </Text>
        </VStack>
        <TextField
          label={t('mfa.code')}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={6}
          editable={!busy}
        />
        {error ? <Alert variant="danger" message={error} /> : null}
        <Button title={t('mfa.verify')} size="lg" fullWidth onPress={submit} loading={busy} />
        <Button title={t('mfa.cancel')} variant="ghost" onPress={() => void cancelMfa()} />
      </VStack>
    </AuthScaffold>
  );
}
