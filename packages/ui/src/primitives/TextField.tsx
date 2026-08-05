import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helper?: string;
  /** Non-empty ⇒ error state (red border + message, replaces helper). */
  error?: string;
}

/** Labelled text input. >=48dp target (P6), a11y label, error state. */
export function TextField({ label, helper, error, editable = true, ...props }: TextFieldProps) {
  const t = useTheme();
  const hasError = !!error;
  return (
    <View style={{ gap: t.spacing.xs, alignSelf: 'stretch' }}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        placeholderTextColor={t.colors.textSecondary}
        style={{
          minHeight: t.touchTarget.min,
          paddingHorizontal: t.spacing.md,
          paddingVertical: t.spacing.sm,
          borderRadius: t.radii.md,
          borderWidth: 1,
          borderColor: hasError ? t.colors.danger : t.colors.border,
          backgroundColor: editable ? t.colors.surface : t.colors.surfaceAlt,
          color: t.colors.textPrimary,
          fontSize: t.fontSizes.md,
        }}
        {...props}
      />
      {error || helper ? (
        <Text variant="caption" color={hasError ? 'danger' : 'textSecondary'}>
          {error || helper}
        </Text>
      ) : null}
    </View>
  );
}
