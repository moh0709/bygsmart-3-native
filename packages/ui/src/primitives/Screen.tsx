import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '@bygsmart/tokens';

export interface ScreenProps extends ViewProps {
  padding?: SpacingToken;
  edges?: readonly Edge[];
  /** surface = card colour, background = app colour (default). */
  surface?: boolean;
}

/** Top-level screen container: safe-area aware, themed background, token padding. */
export function Screen({ padding = 'lg', edges = ['top', 'bottom'], surface, style, children, ...props }: ScreenProps) {
  const t = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: surface ? t.colors.surface : t.colors.background }}
    >
      <View style={[{ flex: 1, padding: t.spacing[padding] }, style]} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
