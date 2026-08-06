// Log ind — real email/password auth against Supabase (adapted from the 2.1 production
// login). On success the AuthProvider session updates and the app-shell swaps this out
// for the app. Presentation via AuthScaffold (brand lockup → card → CTA → links); the
// auth wiring is unchanged. Uses only ui/i18n and the auth hook (AR-05).
import { useState } from 'react';
import { Pressable } from 'react-native';
import { VStack, Text, TextField, Button, Alert, useTheme } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';
import { AuthScaffold, AuthLink } from './AuthScaffold';

export function LoginScreen({
  onRegister,
  onForgot,
}: {
  onRegister?: () => void;
  onForgot?: () => void;
} = {}): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <AuthScaffold
      footer={onRegister ? <AuthLink prefix={t('loginExtra.noAccount')} label={t('loginExtra.toRegister')} onPress={onRegister} /> : undefined}
    >
      <VStack gap="md">
        <VStack gap="xs">
          <Text variant="title" center>
            {t('login.title')}
          </Text>
          <Text variant="body" color="textSecondary" center>
            {t('login.welcome')}
          </Text>
        </VStack>

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

        {error ? <Alert variant="danger" message={error} /> : null}

        <Button title={t('login.submit')} size="lg" fullWidth onPress={submit} loading={busy} />

        {onForgot ? (
          <Pressable
            accessibilityRole="link"
            onPress={onForgot}
            style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.sm }}
          >
            <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
              {t('loginExtra.forgot')}
            </Text>
          </Pressable>
        ) : null}
      </VStack>
    </AuthScaffold>
  );
}
