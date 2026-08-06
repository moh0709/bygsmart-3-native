// Opret konto — email/password + name signup against Supabase (adapted from the 2.1
// register). With email confirmation off the new session lands straight in the app; if a
// project later enables confirmation, requiresConfirmation surfaces a check-your-email
// message. Uses only ui/i18n and the auth hook (AR-05).
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Badge } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

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
            <Text variant="title">{t('register.title')}</Text>
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
            {error ? <Badge label={error} tone="danger" /> : null}
            {notice ? <Badge label={notice} tone="success" /> : null}
            <Button title={t('register.submit')} onPress={submit} loading={busy} />
            {onLogin ? (
              <Button title={`${t('register.haveAccount')} ${t('register.toLogin')}`} variant="ghost" onPress={onLogin} />
            ) : null}
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
