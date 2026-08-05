import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsiveValue } from '../hooks/useBreakpoint';
import type { SpacingToken } from '@bygsmart/tokens';

export interface GridProps {
  children: ReactNode;
  /** Columns per breakpoint. Default 1 / 2 / 3 (phone / tablet / desktop). */
  columns?: { phone?: number; tablet?: number; desktop?: number };
  gap?: SpacingToken;
}

/**
 * Responsive column grid — one UI, three shapes (D-05). Cells reflow from a single
 * phone column to two on tablet and three on desktop. Implemented with the gutter
 * technique (negative container margin + per-cell padding) so it works on RN + RNW.
 */
export function Grid({ children, columns, gap = 'md' }: GridProps) {
  const t = useTheme();
  const cols = useResponsiveValue({
    phone: columns?.phone ?? 1,
    tablet: columns?.tablet ?? 2,
    desktop: columns?.desktop ?? 3,
  });
  const half = t.spacing[gap] / 2;
  const items = Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -half }}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, padding: half }}>
          {child}
        </View>
      ))}
    </View>
  );
}
