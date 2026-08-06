// A compact sync-status row: shows whether a backend is connected, how many writes are
// still queued, and a manual "Synk nu". Offline (no backend configured) it just reports
// the local-only state. Reads everything from the data context (AR-05).
import { HStack, Badge, Button } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData } from '../db/react';

export function SyncBar(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { sync, syncNow, mediaPending } = useData();

  const tone =
    sync.status === 'error' ? 'danger' : sync.status === 'syncing' ? 'primary' : sync.status === 'idle' ? 'success' : 'neutral';
  const label =
    sync.status === 'offline'
      ? t('sync.local')
      : sync.status === 'syncing'
        ? t('sync.syncing')
        : sync.status === 'error'
          ? t('sync.error')
          : t('sync.synced');

  return (
    <HStack justify="space-between" align="center" gap="sm" style={{ flexWrap: 'wrap' }}>
      <HStack gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
        <Badge label={label} tone={tone} />
        {sync.pending > 0 ? <Badge label={t('sync.pending', { count: sync.pending })} tone="warning" /> : null}
        {mediaPending > 0 ? <Badge label={t('media.pending', { count: mediaPending })} tone="warning" /> : null}
      </HStack>
      {sync.status !== 'offline' ? <Button title={t('sync.now')} variant="secondary" onPress={syncNow} /> : null}
    </HStack>
  );
}
