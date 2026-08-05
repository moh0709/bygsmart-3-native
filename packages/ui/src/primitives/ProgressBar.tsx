import { View } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger';

export interface ProgressBarProps {
  /** 0..1, clamped. */
  value: number;
  tone?: ProgressTone;
  label?: string;
}

const TONE: Record<ProgressTone, keyof Theme['colors']> = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** Determinate progress track. a11y progressbar role with 0–100 value. */
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
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.colors[TONE[tone]] }} />
    </View>
  );
}
