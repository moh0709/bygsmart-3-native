import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useBreakpoint } from '../hooks/useBreakpoint';

export interface TwoPaneProps {
  primary: ReactNode;
  secondary: ReactNode;
  /** dp width of the primary (list) column at tablet+ widths. */
  primaryWidth?: number;
}

/**
 * List-detail layout — the core responsive pattern (P7 / D-05). At tablet+ the two
 * panes sit side by side (primary is a fixed-width rail, secondary flexes); on phone
 * they stack into a single column. The same tree renders on all three targets.
 */
export function TwoPane({ primary, secondary, primaryWidth = 320 }: TwoPaneProps) {
  const t = useTheme();
  const { isTabletUp } = useBreakpoint();

  if (!isTabletUp) {
    return (
      <View style={{ flex: 1, gap: t.spacing.md }}>
        <View>{primary}</View>
        <View style={{ flex: 1 }}>{secondary}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: t.spacing.lg }}>
      <View style={{ width: primaryWidth }}>{primary}</View>
      <View
        style={{
          flex: 1,
          borderLeftWidth: 1,
          borderLeftColor: t.colors.border,
          paddingLeft: t.spacing.lg,
        }}
      >
        {secondary}
      </View>
    </View>
  );
}
