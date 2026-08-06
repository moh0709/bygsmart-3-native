// To-faktor-godkendelse — the login-time TOTP challenge (aal1 → aal2). Shown by the
// app-shell gate when a signed-in session still owes its second factor. Enter the
// 6-digit code → verifyMfa; Annuller signs the half-authenticated session out. Uses
// only ui/i18n and the auth hook (AR-05).
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Badge } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

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
    <Screen padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1, justifyContent: 'center' }}>
        <Card>
          <VStack gap="md">
            <Text variant="title">{t('mfa.title')}</Text>
            <Text variant="body" color="textSecondary">
              {t('mfa.subtitle')}
            </Text>
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
            {error ? <Badge label={error} tone="danger" /> : null}
            <Button title={t('mfa.verify')} onPress={submit} loading={busy} />
            <Button title={t('mfa.cancel')} variant="ghost" onPress={() => void cancelMfa()} />
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
