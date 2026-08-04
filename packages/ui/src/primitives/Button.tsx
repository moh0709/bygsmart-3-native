import { Pressable, ActivityIndicator, type PressableProps } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

function palette(t: Theme, variant: ButtonVariant): { bg: string; fg: keyof Theme['colors']; border?: string } {
  switch (variant) {
    case 'primary':
      return { bg: t.colors.primary, fg: 'primaryText' };
    case 'danger':
      return { bg: t.colors.danger, fg: 'textInverse' };
    case 'secondary':
      return { bg: t.colors.surfaceAlt, fg: 'textPrimary', border: t.colors.border };
    case 'ghost':
      return { bg: 'transparent', fg: 'primary' };
  }
}

/** Primary action. >=48dp target (P6), a11y button role + disabled/busy state. */
export function Button({ title, variant = 'primary', loading, fullWidth, disabled, style, ...props }: ButtonProps) {
  const t = useTheme();
  const p = palette(t, variant);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        {
          minHeight: t.touchTarget.min,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.sm,
          borderRadius: t.radii.md,
          backgroundColor: p.bg,
          ...(p.border && { borderWidth: 1, borderColor: p.border }),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: t.spacing.sm,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
          ...(fullWidth && { alignSelf: 'stretch' }),
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={t.colors[p.fg]} /> : null}
      <Text variant="label" color={p.fg} style={{ fontSize: t.fontSizes.md }}>
        {title}
      </Text>
    </Pressable>
  );
}
