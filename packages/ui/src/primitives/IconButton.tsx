import { Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface IconButtonProps {
  /** Icon glyph (emoji/text today; the 1.6 icon package swaps this for an SVG node). */
  icon: string;
  /** Required — an icon alone has no accessible name. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'plain' | 'filled';
  disabled?: boolean;
}

/** Square icon-only action. Always a >=48dp target (P6), a11y button role + label. */
export function IconButton({ icon, accessibilityLabel, onPress, variant = 'plain', disabled }: IconButtonProps) {
  const t = useTheme();
  const filled = variant === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(s) => ({
        width: t.touchTarget.min,
        height: t.touchTarget.min,
        borderRadius: filled ? t.radii.md : t.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? t.colors.surfaceAlt : 'transparent',
        opacity: disabled ? 0.5 : s.pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: t.fontSizes.xl }}>{icon}</Text>
    </Pressable>
  );
}
