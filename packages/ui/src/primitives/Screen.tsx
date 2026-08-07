import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { SpacingToken } from '@bygsmart/tokens';

/** Readable content column cap on tablet/desktop — phones stay full-width. */
const CONTENT_MAX_WIDTH = 760;

export interface ScreenProps extends ViewProps {
  padding?: SpacingToken;
  edges?: readonly Edge[];
  /** surface = card colour, background = app colour (default). */
  surface?: boolean;
  /** Opt out of the tablet/desktop max-width cap (e.g. a full-bleed two-pane layout). */
  fullBleed?: boolean;
}

/** Top-level screen container: safe-area aware, themed background, token padding. On
 *  tablet+ the content is capped to a readable column and centred so it never stretches
 *  edge-to-edge (phones are unaffected). */
export function Screen({
  padding = 'lg',
  edges = ['top', 'bottom'],
  surface,
  fullBleed,
  style,
  children,
  ...props
}: ScreenProps) {
  const t = useTheme();
  const { isTabletUp } = useBreakpoint();
  const capped = isTabletUp && !fullBleed;
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: surface ? t.colors.surface : t.colors.background }}
    >
      <View
        style={[
          { flex: 1, padding: t.spacing[padding], width: '100%' },
          capped && { maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
