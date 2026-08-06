// Nulstil adgangskode — request a password-reset email (adapted from 2.1's
// resetPassword). Sends the recovery link; the set-new-password step happens when the
// user follows that link (or via Skift adgangskode while signed in). Uses only ui/i18n
// and the auth hook (AR-05).
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Badge } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

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
    <Screen padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1, justifyContent: 'center' }}>
        <Card>
          <VStack gap="md">
            <Text variant="title">{t('forgot.title')}</Text>
            <Text variant="body" color="textSecondary">
              {t('forgot.subtitle')}
            </Text>
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
            {error ? <Badge label={error} tone="danger" /> : null}
            {notice ? <Badge label={notice} tone="success" /> : null}
            <Button title={t('forgot.submit')} onPress={submit} loading={busy} />
            {onBack ? <Button title={t('forgot.back')} variant="ghost" onPress={onBack} /> : null}
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
