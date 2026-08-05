import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
}

/** Compact filter/choice chip. Pressable ⇒ a11y button role + selected state. */
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const t = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radii.pill,
        borderWidth: 1,
        borderColor: selected ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.primary + '1A' : t.colors.surface,
      }}
    >
      {icon ? <Text style={{ fontSize: t.fontSizes.sm }}>{icon}</Text> : null}
      <Text variant="label" color={selected ? 'primary' : 'textSecondary'}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={(s) => ({ opacity: s.pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}
