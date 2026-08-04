import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface SpinnerProps {
  label?: string;
  size?: 'small' | 'large';
}

/** Loading indicator with an optional label. a11y announces busy state. */
export function Spinner({ label, size = 'large' }: SpinnerProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Indlæser'}
      style={{ alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.lg }}
    >
      <ActivityIndicator size={size} color={t.colors.primary} />
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
