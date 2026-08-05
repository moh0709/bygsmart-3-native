import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Full name; initials are derived from it. */
  name: string;
  size?: AvatarSize;
}

const DIMEN: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 13 },
  md: { box: 44, font: 16 },
  lg: { box: 64, font: 22 },
};

/** Deterministic initials from a name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Circular initials avatar. a11y image role labelled with the name. */
export function Avatar({ name, size = 'md' }: AvatarProps) {
  const t = useTheme();
  const d = DIMEN[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: d.box,
        height: d.box,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: t.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: d.font, fontWeight: t.fontWeights.semibold, color: t.colors.textPrimary }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
