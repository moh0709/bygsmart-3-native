// Log ind — real email/password auth against Supabase (adapted from the 2.1 production
// login). On success the AuthProvider session updates and the app-shell swaps this out
// for the app. Uses only ui/i18n and the auth hook (AR-05).
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Badge } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

export function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await login(email, password);
    setBusy(false);
    if (!res.success) setError(res.message);
  };

  return (
    <Screen padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1, justifyContent: 'center' }}>
        <VStack gap="xs">
          <Text variant="display">{t('common.appName')}</Text>
          <Text variant="body" color="textSecondary">
            {t('login.subtitle')}
          </Text>
        </VStack>

        <Card>
          <VStack gap="md">
            <Text variant="title">{t('login.title')}</Text>
            <TextField
              label={t('login.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="dig@firma.dk"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!busy}
            />
            <TextField
              label={t('login.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!busy}
            />
            {error ? <Badge label={error} tone="danger" /> : null}
            <Button title={t('login.submit')} onPress={submit} loading={busy} />
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
