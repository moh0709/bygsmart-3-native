import { Screen, VStack, Text, Card, Badge, type BadgeTone } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import type { StorageTier } from '@bygsmart/core';
import { useStorageCapabilities } from '../src/capabilities/useStorageCapabilities';

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
      </VStack>
    </Screen>
  );
}
