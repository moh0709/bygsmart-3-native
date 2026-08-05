import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

export interface RadioGroupProps<T extends string> {
  options: RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  disabled?: boolean;
}

/** Single-select group. a11y radio role + selected state per row, >=48dp rows (P6). */
export function RadioGroup<T extends string>({ options, value, onChange, label, disabled }: RadioGroupProps<T>) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: t.spacing.xs }}>
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={opt.label}
            disabled={disabled}
            onPress={() => onChange(opt.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              minHeight: t.touchTarget.min,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: t.radii.pill,
                borderWidth: 2,
                borderColor: selected ? t.colors.primary : t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                <View
                  style={{ width: 10, height: 10, borderRadius: t.radii.pill, backgroundColor: t.colors.primary }}
                />
              ) : null}
            </View>
            <Text variant="body">{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
