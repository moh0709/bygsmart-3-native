import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger';

export interface ProgressBarProps {
  /** 0..1, clamped. */
  value: number;
  tone?: ProgressTone;
  label?: string;
}

/** 2.1 gradient fills (light→base), matching the icon bubbles. */
const FILLS: Record<ProgressTone, [string, string]> = {
  primary: ['#60A5FA', '#1E5FFF'],
  success: ['#34D399', '#1BB55C'],
  warning: ['#FBBF50', '#F5A524'],
  danger: ['#F97066', '#E5484D'],
};

/** Determinate progress track with a gradient fill. a11y progressbar role with 0–100 value. */
export function ProgressBar({ value, tone = 'primary', label }: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ now: pct, min: 0, max: 100 }}
      style={{
        height: 8,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.surfaceAlt,
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <LinearGradient
        colors={FILLS[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height: '100%', borderRadius: t.radii.pill }}
      />
    </View>
  );
}
