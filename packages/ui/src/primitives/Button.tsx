import { Pressable, ActivityIndicator, type PressableProps } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

function palette(
  t: Theme,
  variant: ButtonVariant,
): { bg: string; fg: keyof Theme['colors']; border?: string; glow?: boolean } {
  switch (variant) {
    case 'primary':
      return { bg: t.colors.primary, fg: 'primaryText', glow: true };
    case 'danger':
      return { bg: t.colors.danger, fg: 'textInverse' };
    case 'secondary':
      return { bg: t.colors.surfaceAlt, fg: 'textPrimary', border: t.colors.border };
    case 'outline':
      return { bg: 'transparent', fg: 'primary', border: t.colors.primary };
    case 'ghost':
      return { bg: 'transparent', fg: 'primary' };
  }
}

/** Height/padding/type per size. All heights stay >= 48dp (P6, gloves). */
function sizing(t: Theme, size: ButtonSize): { minHeight: number; padH: number; padV: number; font: number } {
  switch (size) {
    case 'sm':
      return { minHeight: t.touchTarget.min, padH: t.spacing.md, padV: t.spacing.xs, font: t.fontSizes.sm };
    case 'lg':
      return { minHeight: 52, padH: t.spacing.xl, padV: t.spacing.md, font: t.fontSizes.md };
    case 'md':
      return { minHeight: t.touchTarget.min, padH: t.spacing.lg, padV: t.spacing.sm, font: 15 };
  }
}

/** Primary action. >=48dp target (P6), a11y button role + disabled/busy state. */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const t = useTheme();
  const p = palette(t, variant);
  const s = sizing(t, size);
  const isDisabled = disabled || loading;
  // Brand-tinted lift on the primary CTA — the 2.1 "shadow-brand" glow, derived from
  // the active theme's brand so dark/outdoor stay coherent. Suppressed while disabled.
  const glow =
    p.glow && !isDisabled
      ? {
          shadowColor: t.colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 4,
        }
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        {
          minHeight: s.minHeight,
          paddingHorizontal: s.padH,
          paddingVertical: s.padV,
          borderRadius: t.radii.md,
          backgroundColor: p.bg,
          ...(p.border && { borderWidth: variant === 'outline' ? 1.5 : 1, borderColor: p.border }),
          ...(glow ?? {}),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: t.spacing.sm,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.9 : 1,
          ...(fullWidth && { alignSelf: 'stretch' }),
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={t.colors[p.fg]} /> : null}
      <Text variant="label" color={p.fg} style={{ fontSize: s.font, fontWeight: '600' }}>
        {title}
      </Text>
    </Pressable>
  );
}
