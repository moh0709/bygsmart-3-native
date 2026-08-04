import { Pressable, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
}

/** Surface container. Becomes a button when onPress is given (a11y role follows). */
export function Card({ onPress, padded = true, style, children, ...props }: CardProps) {
  const t = useTheme();
  const base = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
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
