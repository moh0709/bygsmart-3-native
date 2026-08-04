import { useWindowDimensions } from 'react-native';
import { breakpoints, type Breakpoint } from '@bygsmart/tokens';

export interface BreakpointState {
  name: Breakpoint;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True at tablet width and above — the two-pane threshold (P7). */
  isTabletUp: boolean;
  width: number;
}

/** One UI, three shapes (D-05). Every responsive primitive reads this. */
export function useBreakpoint(): BreakpointState {
  const { width } = useWindowDimensions();
  const name: Breakpoint =
    width >= breakpoints.desktop ? 'desktop' : width >= breakpoints.tablet ? 'tablet' : 'phone';
  return {
    name,
    isPhone: name === 'phone',
    isTablet: name === 'tablet',
    isDesktop: name === 'desktop',
    isTabletUp: width >= breakpoints.tablet,
    width,
  };
}

/** Pick a value by breakpoint, falling back to the nearest smaller defined value. */
export function useResponsiveValue<T>(values: { phone: T; tablet?: T; desktop?: T }): T {
  const { name } = useBreakpoint();
  if (name === 'desktop') return values.desktop ?? values.tablet ?? values.phone;
  if (name === 'tablet') return values.tablet ?? values.phone;
  return values.phone;
}
