import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Badge,
  Button,
  Avatar,
  ListItem,
  Divider,
  IconBubble,
  type BadgeTone,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import type { StorageTier } from '@bygsmart/core';
import { useOptionalSession } from '@bygsmart/api-client';
import { useStorageCapabilities } from '../src/capabilities/useStorageCapabilities';

/** Identity card — avatar + name + email, when signed in (the 2.1 settings top block). */
function ProfileCard() {
  const auth = useOptionalSession();
  const user = auth?.user;
  if (!user) return null;
  const name = (user.user_metadata?.name as string | undefined) ?? undefined;
  const email = user.email ?? '';
  const primary = name || email;
  return (
    <Card>
      <HStack gap="md" align="center">
        <Avatar name={primary} />
        <VStack gap="none" style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {primary}
          </Text>
          {name && email ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </Card>
  );
}

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
  const chevron = <Text variant="title" color="textTertiary">›</Text>;
  return (
    <Card>
      <VStack gap="sm">
        <Text variant="heading">{t('security.title')}</Text>
        <HStack justify="space-between" align="center">
          <Text variant="body">{t('security.mfa')}</Text>
          <Badge
            label={mfaOn == null ? '…' : mfaOn ? t('security.on') : t('security.off')}
            tone={mfaOn ? 'success' : 'neutral'}
          />
        </HStack>
        <Divider />
        <ListItem
          title={t('security.manage')}
          leading={<IconBubble icon="lock" tone="brand" size={36} />}
          trailing={chevron}
          onPress={() => router.navigate('/mfa-enroll' as Href)}
        />
        <ListItem
          title={t('security.changePassword')}
          leading={<IconBubble icon="key" tone="info" size={36} />}
          trailing={chevron}
          onPress={() => router.navigate('/change-password' as Href)}
        />
        <Divider />
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
        <Text variant="title">{t('more.title')}</Text>

        <ProfileCard />

        <Card>
          <VStack gap="sm">
            <Text variant="heading">{t('more.appTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('more.appSubtitle')}
            </Text>
            <Badge label={t('more.badgeDev')} tone="pending" />
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="heading">{t('capabilities.title')}</Text>
            {loading || !copy ? (
              <Text variant="body" color="textSecondary">
                {t('capabilities.detecting')}
              </Text>
            ) : (
              <VStack gap="sm">
                <Badge label={copy.label} tone={copy.tone} />
                <Text variant="body" color="textSecondary">
                  {copy.body}
                </Text>
              </VStack>
            )}
          </VStack>
        </Card>

        <SecurityCard />
      </VStack>
    </Screen>
  );
}
