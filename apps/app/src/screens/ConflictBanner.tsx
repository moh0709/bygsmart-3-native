// Surfaces parked sync conflicts and lets the user resolve each one: keep the server's
// version or keep theirs (re-queued on top). Renders nothing when there are no
// conflicts. Reads conflicts + resolveConflict from the data context (AR-05).
import { VStack, HStack, Card, Button, Badge, Alert } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData } from '../db/react';

/** A short human label for a row: prefer title/name, else the status, else the id. */
function describe(row: Record<string, unknown> | null): string {
  if (!row) return '—';
  return String(row.title ?? row.name ?? row.status ?? row.id ?? '—');
}

export function ConflictBanner(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { conflicts, resolveConflict } = useData();
  if (conflicts.length === 0) return null;

  return (
    <Card>
      <VStack gap="md">
        <Alert variant="warning" title={t('conflict.title')} message={t('conflict.body')} />
        {conflicts.map((c) => (
          <VStack key={c.id} gap="xs">
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Badge label={`${t('conflict.mine')}: ${describe(c.mine)}`} tone="primary" />
              <Badge label={`${t('conflict.server')}: ${describe(c.server)}`} tone="neutral" />
            </HStack>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Button title={t('conflict.keepServer')} variant="secondary" size="sm" onPress={() => resolveConflict(c.id, 'server')} />
              <Button title={t('conflict.keepMine')} size="sm" onPress={() => resolveConflict(c.id, 'mine')} />
            </HStack>
          </VStack>
        ))}
      </VStack>
    </Card>
  );
}
