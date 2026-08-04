import { View, type ViewProps } from 'react-native';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import type { SpacingToken, RadiusToken } from '@bygsmart/tokens';

export interface BoxProps extends ViewProps {
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  bg?: keyof Theme['colors'];
  radius?: RadiusToken;
  border?: boolean;
  flex?: number;
}

/** The layout atom — a themed View with token-driven padding/background/radius. */
export function Box({ padding, paddingX, paddingY, bg, radius, border, flex, style, ...props }: BoxProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          ...(padding != null && { padding: t.spacing[padding] }),
          ...(paddingX != null && { paddingHorizontal: t.spacing[paddingX] }),
          ...(paddingY != null && { paddingVertical: t.spacing[paddingY] }),
          ...(bg != null && { backgroundColor: t.colors[bg] }),
          ...(radius != null && { borderRadius: t.radii[radius] }),
          ...(border && { borderWidth: 1, borderColor: t.colors.border }),
          ...(flex != null && { flex }),
        },
        style,
      ]}
      {...props}
    />
  );
}
