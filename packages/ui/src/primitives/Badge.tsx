import { View } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'pending';

const TONE: Record<BadgeTone, keyof Theme['colors']> = {
  neutral: 'textSecondary',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  pending: 'pending',
};

/** Compact status pill — used heavily for sync state (pending/synced/failed), P3. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = useTheme();
  const c = t.colors[TONE[tone]];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 2,
        borderRadius: t.radii.pill,
        backgroundColor: c + '22',
        borderWidth: 1,
        borderColor: c,
      }}
    >
      <Text variant="caption" style={{ color: c, fontWeight: t.fontWeights.semibold }}>
        {label}
      </Text>
    </View>
  );
}
