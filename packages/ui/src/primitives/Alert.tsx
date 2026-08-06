import { View, type ViewProps } from 'react-native';
import type { ColorToken } from '@bygsmart/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

export interface AlertProps extends ViewProps {
  variant?: AlertVariant;
  title?: string;
  message?: string;
}

/**
 * Inline status banner — tinted `*Subtle` surface + `*Border` hairline + AA `*Strong`
 * text, mirroring the 2.1 Alert. Used for form errors, offline notices, etc. The a11y
 * role is `alert` so screen readers announce it.
 */
export function Alert({ variant = 'info', title, message, children, style, ...props }: AlertProps) {
  const t = useTheme();
  const bg = `${variant}Subtle` as ColorToken;
  const border = `${variant}Border` as ColorToken;
  const fg = `${variant}Strong` as ColorToken;
  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          alignSelf: 'stretch',
          backgroundColor: t.colors[bg],
          borderWidth: 1,
          borderColor: t.colors[border],
          borderRadius: t.radii.md,
          paddingHorizontal: t.spacing.md,
          paddingVertical: t.spacing.sm,
          gap: t.spacing.xs / 2,
        },
        style,
      ]}
      {...props}
    >
      {title ? (
        <Text variant="label" color={fg} style={{ fontWeight: '700' }}>
          {title}
        </Text>
      ) : null}
      {message ? (
        <Text variant="label" color={fg}>
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
