import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Horizontal segmented selector — segments share the full width equally, so it
 * reads the same on phone and tablet. a11y button role + selected state per segment.
 */
export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'stretch',
        backgroundColor: t.colors.surfaceAlt,
        borderRadius: t.radii.md,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: 2,
        gap: 2,
      }}
    >
      {segments.map((seg) => {
        const selected = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={seg.label}
            onPress={() => onChange(seg.value)}
            style={{
              flex: 1,
              minHeight: t.touchTarget.min - 8,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: t.spacing.sm,
              borderRadius: t.radii.sm,
              backgroundColor: selected ? t.colors.surface : 'transparent',
            }}
          >
            <Text
              variant="label"
              color={selected ? 'textPrimary' : 'textSecondary'}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
