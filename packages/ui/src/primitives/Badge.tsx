import { View } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'pending';

/** Tinted-surface pill: `*Subtle` bg + `*Border` hairline + `*Strong` (AA) text — the 2.1
 *  badge style. `neutral` and `pending` fold onto the surface / warning families. */
function styleFor(t: Theme, tone: BadgeTone): { bg: string; border: string; fg: keyof Theme['colors'] } {
  const c = t.colors;
  switch (tone) {
    case 'primary':
      return { bg: c.primarySubtle, border: c.primaryBorder, fg: 'primaryStrong' };
    case 'success':
      return { bg: c.successSubtle, border: c.successBorder, fg: 'successStrong' };
    case 'warning':
      return { bg: c.warningSubtle, border: c.warningBorder, fg: 'warningStrong' };
    case 'danger':
      return { bg: c.dangerSubtle, border: c.dangerBorder, fg: 'dangerStrong' };
    case 'pending':
      return { bg: c.warningSubtle, border: c.warningBorder, fg: 'pending' };
    case 'neutral':
      return { bg: c.surfaceAlt, border: c.border, fg: 'textSecondary' };
  }
}

/** Compact status pill — used heavily for sync state (pending/synced/failed), P3, and
 *  status chips (project status, task counts). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = useTheme();
  const s = styleFor(t, tone);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 3,
        borderRadius: t.radii.pill,
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
      }}
    >
      <Text variant="caption" color={s.fg} style={{ fontWeight: t.fontWeights.semibold }}>
        {label}
      </Text>
    </View>
  );
}
