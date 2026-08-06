import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Screen, VStack, HStack, Text, Card, Badge, Button, type BadgeTone } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import type { StorageTier } from '@bygsmart/core';
import { useOptionalSession } from '@bygsmart/api-client';
import { useStorageCapabilities } from '../src/capabilities/useStorageCapabilities';

/** Security card — only when signed in (a backend session exists). MFA state + manage +
 * logout. Reads via useOptionalSession so offline-first mode (no AuthProvider) is safe. */
function SecurityCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const auth = useOptionalSession();
  const [mfaOn, setMfaOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!auth) return;
    let alive = true;
    void auth.listTotpFactors().then((f) => alive && setMfaOn(f.some((x) => x.status === 'verified')));
    return () => {
      alive = false;
    };
  }, [auth]);

  if (!auth) return null;
  return (
    <Card>
      <VStack gap="sm">
        <Text variant="title">{t('security.title')}</Text>
        <HStack justify="space-between" align="center">
          <Text variant="body">{t('security.mfa')}</Text>
          <Badge
            label={mfaOn == null ? '…' : mfaOn ? t('security.on') : t('security.off')}
            tone={mfaOn ? 'success' : 'neutral'}
          />
        </HStack>
        <Button title={t('security.manage')} variant="secondary" onPress={() => router.navigate('/mfa-enroll' as Href)} />
        <Button title={t('security.logout')} variant="ghost" onPress={() => void auth.logout()} />
      </VStack>
    </Card>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

/** Tier → Danish copy + badge tone, using literal (type-checked) i18n keys. */
function tierCopy(t: TFn, tier: StorageTier): { label: string; body: string; tone: BadgeTone } {
  switch (tier) {
    case 'full':
      return { label: t('capabilities.tierFull'), body: t('capabilities.full'), tone: 'success' };
    case 'session-durable':
      return { label: t('capabilities.tierSession'), body: t('capabilities.session'), tone: 'warning' };
    case 'online-only':
      return { label: t('capabilities.tierOnline'), body: t('capabilities.online'), tone: 'danger' };
  }
}

export default function More() {
  const { t } = useTranslation();
  const { loading, tier } = useStorageCapabilities();
  const copy = tier ? tierCopy(t, tier) : null;

  return (
    <Screen edges={['top']}>
      <VStack gap="md">
        <Text variant="heading">{t('more.title')}</Text>
        <Card>
          <VStack gap="sm">
            <Text variant="title">{t('more.appTitle')}</Text>
            <Text variant="body" color="textSecondary">{t('more.appSubtitle')}</Text>
            <Badge label={t('more.badgeDev')} tone="pending" />
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">{t('capabilities.title')}</Text>
            {loading || !copy ? (
              <Text variant="body" color="textSecondary">{t('capabilities.detecting')}</Text>
            ) : (
              <VStack gap="sm">
                <Badge label={copy.label} tone={copy.tone} />
                <Text variant="body" color="textSecondary">{copy.body}</Text>
              </VStack>
            )}
          </VStack>
        </Card>

        <SecurityCard />
      </VStack>
    </Screen>
  );
}
