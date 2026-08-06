// To-faktor-sikkerhed — in-app TOTP enrollment (replaces the dev enroll script for real
// users). Enroll → show the secret to add to an authenticator app → confirm a code to
// activate. Shows the current state and lets the user disable it. Post-auth screen
// (reached from Mere). Uses only ui/i18n and the auth hook (AR-05).
import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, TextField, Button, Badge, Divider } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useSession, type EnrollTotpData, type TotpFactor } from '@bygsmart/api-client';

export function MfaEnrollScreen({ onDone }: { onDone?: () => void } = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { enrollTotp, confirmTotp, listTotpFactors, unenrollTotp } = useSession();
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enroll, setEnroll] = useState<EnrollTotpData | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setFactors(await listTotpFactors());
  }, [listTotpFactors]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verified = factors.find((f) => f.status === 'verified');

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const res = await enrollTotp();
    setBusy(false);
    if (res.ok) setEnroll(res.data);
    else setError(res.message);
  };

  const activate = async (): Promise<void> => {
    if (!enroll) return;
    setBusy(true);
    setError(null);
    const res = await confirmTotp(enroll.factorId, code);
    setBusy(false);
    if (res.success) {
      setEnroll(null);
      setCode('');
      await refresh();
    } else setError(res.message);
  };

  const disable = async (): Promise<void> => {
    if (!verified) return;
    setBusy(true);
    // Clean up any half-finished enrollments too.
    for (const f of factors) await unenrollTotp(f.id);
    setEnroll(null);
    await refresh();
    setBusy(false);
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text variant="heading">{t('mfaEnroll.title')}</Text>

        <Card>
          <VStack gap="md">
            {verified ? (
              <>
                <Badge label={t('mfaEnroll.activeTitle')} tone="success" />
                <Text variant="body" color="textSecondary">
                  {t('mfaEnroll.activeBody')}
                </Text>
                <Button title={t('mfaEnroll.disable')} variant="danger" onPress={disable} loading={busy} />
              </>
            ) : enroll ? (
              <>
                <Text variant="body" color="textSecondary">
                  {t('mfaEnroll.secretLabel')}
                </Text>
                <Card padded>
                  <Text variant="title" center>
                    {enroll.secret}
                  </Text>
                </Card>
                <Divider />
                <TextField
                  label={t('mfaEnroll.code')}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!busy}
                />
                {error ? <Badge label={error} tone="danger" /> : null}
                <Button title={t('mfaEnroll.activate')} onPress={activate} loading={busy} />
              </>
            ) : (
              <>
                <Text variant="body" color="textSecondary">
                  {t('mfaEnroll.intro')}
                </Text>
                {error ? <Badge label={error} tone="danger" /> : null}
                <Button title={t('mfaEnroll.start')} onPress={start} loading={busy} />
              </>
            )}
          </VStack>
        </Card>

        {onDone ? <Button title={t('mfaEnroll.back')} variant="ghost" onPress={onDone} /> : null}
      </ScrollView>
    </Screen>
  );
}
