// A compact sync-status strip: a colored status dot + label, how many writes are still
// queued, this tab's writer/reader role, and a manual "Synk nu". Offline (no backend
// configured) it just reports the local-only state. Reads everything from the data
// context (AR-05).
import { View } from 'react-native';
import { HStack, Text, Badge, Button, useTheme, type ColorToken } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData } from '../db/react';

export function SyncBar(): React.JSX.Element | null {
  const { t } = useTranslation();
  const theme = useTheme();
  const { sync, syncNow, mediaPending, isWriter } = useData();

  const dotColor: ColorToken =
    sync.status === 'error'
      ? 'danger'
      : sync.status === 'syncing'
        ? 'primary'
        : sync.status === 'idle'
          ? 'success'
          : 'textTertiary';
  const label =
    sync.status === 'offline'
      ? t('sync.local')
      : sync.status === 'syncing'
        ? t('sync.syncing')
        : sync.status === 'error'
          ? t('sync.error')
          : t('sync.synced');

  return (
    <HStack
      justify="space-between"
      align="center"
      gap="sm"
      style={{
        flexWrap: 'wrap',
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radii.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <HStack gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors[dotColor] }} />
        <Text variant="label">{label}</Text>
        {sync.status !== 'offline' ? (
          <Badge label={isWriter ? t('sync.writer') : t('sync.reader')} tone={isWriter ? 'success' : 'neutral'} />
        ) : null}
        {sync.pending > 0 ? <Badge label={t('sync.pending', { count: sync.pending })} tone="warning" /> : null}
        {mediaPending > 0 ? <Badge label={t('media.pending', { count: mediaPending })} tone="warning" /> : null}
      </HStack>
      {sync.status !== 'offline' ? <Button title={t('sync.now')} variant="ghost" size="sm" onPress={syncNow} /> : null}
    </HStack>
  );
}
