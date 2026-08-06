// Log ind — real email/password auth against Supabase (adapted from the 2.1 production
// login). On success the AuthProvider session updates and the app-shell swaps this out
// for the app. Presentation adapts the 2.1 LoginPage (brand lockup → centered card →
// primary CTA → brand links); the auth wiring is unchanged. Uses only ui/i18n and the
// auth hook (AR-05).
import { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { Screen, VStack, HStack, Text, Card, TextField, Button, Alert, BrandMark, useTheme } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

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
    <Screen padding="none">
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Centered column, capped like the 2.1 max-w-md */}
        <VStack gap="xl" style={{ width: '100%', maxWidth: 420 }}>
          {/* Brand lockup — house mark in a brand tile + wordmark */}
          <VStack gap="sm" style={{ alignItems: 'center' }}>
            <HStack gap="md" style={{ alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: theme.colors.primary,
                  padding: theme.spacing.md,
                  borderRadius: theme.radii.lg,
                  ...theme.elevation.card,
                }}
              >
                <BrandMark size={30} color={theme.colors.primaryText} />
              </View>
              <Text variant="title" style={{ letterSpacing: 1 }}>
                BYG SMART
              </Text>
            </HStack>
            <Text variant="label" color="textSecondary" center>
              {t('login.subtitle')}
            </Text>
          </VStack>

          <Card padded>
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
          </Card>

          {onRegister ? (
            <HStack gap="xs" style={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text variant="label" color="textSecondary">
                {t('loginExtra.noAccount')}
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={onRegister}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs }}
              >
                <Text variant="label" color="primary" style={{ fontWeight: '700' }}>
                  {t('loginExtra.toRegister')}
                </Text>
              </Pressable>
            </HStack>
          ) : null}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
