import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type SyncState = 'offline' | 'pending' | 'syncing' | 'synced';

const COPY: Record<SyncState, { label: string; tone: 'pending' | 'primary' | 'success' }> = {
  offline: { label: 'Offline – ændringer gemmes lokalt', tone: 'pending' },
  pending: { label: 'Venter på synkronisering', tone: 'pending' },
  syncing: { label: 'Synkroniserer…', tone: 'primary' },
  synced: { label: 'Alt er synkroniseret', tone: 'success' },
};

/**
 * The app never lies about state (P3). Surfaces offline/pending/syncing/synced honestly.
 * Hidden when synced and `hideWhenSynced` (default) to avoid noise.
 */
export function OfflineBanner({ state, pendingCount, hideWhenSynced = true }: { state: SyncState; pendingCount?: number; hideWhenSynced?: boolean }) {
  const t = useTheme();
  if (state === 'synced' && hideWhenSynced) return null;
  const { label, tone } = COPY[state];
  const c = t.colors[tone];
  const text = pendingCount && pendingCount > 0 ? `${label} (${pendingCount})` : label;
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      style={{ backgroundColor: c + '1A', borderBottomWidth: 1, borderBottomColor: c, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm }}
    >
      <Text variant="label" style={{ color: c }}>
        {text}
      </Text>
    </View>
  );
}
