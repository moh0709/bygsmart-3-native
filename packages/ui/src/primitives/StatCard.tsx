import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { elevate } from '../theme/elevation';
import { Text } from './Text';
import { IconBubble, type BubbleTone } from './IconBubble';
import type { IconName } from '../icons/iconRegistry';

export interface StatCardProps {
  value: number | string;
  label: string;
  icon: IconName;
  tone?: BubbleTone;
  onPress?: () => void;
}

const nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/**
 * Compact KPI tile — a gradient icon bubble beside a big value + label, on a rich card.
 * The "Mit overblik" grid unit from the 2.1 home. Renders as a button when onPress is given.
 */
export function StatCard({ value, label, icon, tone = 'brand', onPress }: StatCardProps) {
  const t = useTheme();
  const display = typeof value === 'number' ? nf.format(Math.round(value)) : value;
  const valueColor =
    tone === 'danger' ? 'dangerStrong' : tone === 'warning' ? 'warningStrong' : tone === 'success' ? 'successStrong' : 'textPrimary';

  const body = (
    <>
      <IconBubble icon={icon} tone={tone} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title" color={valueColor} numberOfLines={1} style={{ fontWeight: '800' }}>
          {display}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ fontWeight: '600' }}>
          {label}
        </Text>
      </View>
    </>
  );

  const base = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.md,
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor:
      tone === 'danger' ? t.colors.dangerBorder : tone === 'warning' ? t.colors.warningBorder : t.colors.border,
    padding: t.spacing.md,
    ...elevate(t.elevation.card),
  };

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [base, { flex: 1, opacity: s.pressed ? 0.9 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={[base, { flex: 1 }]}>{body}</View>;
}
