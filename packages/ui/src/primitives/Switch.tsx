import { Switch as RNSwitch, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/** Labelled toggle. Wraps RN Switch (a11y switch role built in); label row is >=48dp. */
export function Switch({ value, onValueChange, label, disabled }: SwitchProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: t.spacing.md,
        minHeight: t.touchTarget.min,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label ? <Text variant="body">{label}</Text> : null}
      <RNSwitch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: t.colors.primary, false: t.colors.border }}
        thumbColor={t.colors.surface}
      />
    </View>
  );
}
