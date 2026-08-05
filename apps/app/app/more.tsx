import { Screen, VStack, Text, Card, Badge } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';

export default function More() {
  const { t } = useTranslation();
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
      </VStack>
    </Screen>
  );
}
