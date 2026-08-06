// Skift adgangskode — set a new password for the signed-in session (updateUser). Also
// the target of a recovery-link session once that redirect is wired. Post-auth screen
// reached from Mere. Uses only ui/i18n and the auth hook (AR-05).
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Alert } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession } from '@bygsmart/api-client';

export function ChangePasswordScreen({ onDone }: { onDone?: () => void } = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { updatePassword } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (busy) return;
    if (password !== confirm) {
      setError(t('changePassword.mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.success) {
      setNotice(res.message);
      setPassword('');
      setConfirm('');
    } else setError(res.message);
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text variant="title">{t('changePassword.title')}</Text>
        <Card>
          <VStack gap="md">
            <TextField
              label={t('changePassword.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <TextField
              label={t('changePassword.confirm')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            {error ? <Alert variant="danger" message={error} /> : null}
            {notice ? <Alert variant="success" message={notice} /> : null}
            <Button title={t('changePassword.submit')} size="lg" fullWidth onPress={submit} loading={busy} />
          </VStack>
        </Card>
        {onDone ? <Button title={t('changePassword.back')} variant="ghost" onPress={onDone} /> : null}
      </ScrollView>
    </Screen>
  );
}
