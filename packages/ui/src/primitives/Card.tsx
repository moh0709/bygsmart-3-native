import { Pressable, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  /** Drop the shadow (nested cards, dense lists). Keeps the hairline border. */
  flat?: boolean;
}

/**
 * Surface container. Carries the 2.1 `shadow-card` elevation + hairline border so it
 * reads as a raised surface, not a flat box. `flat` opts out of the shadow. Becomes a
 * button when onPress is given (a11y role follows).
 */
export function Card({ onPress, padded = true, flat, style, children, ...props }: CardProps) {
  const t = useTheme();
  const base = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...(flat ? {} : t.elevation.card),
    ...(padded && { padding: t.spacing.lg }),
  } as const;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={(s) => [base, { opacity: s.pressed ? 0.9 : 1 }, style as object]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...props}>
      {children}
    </View>
  );
}
