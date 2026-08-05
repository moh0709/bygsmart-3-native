import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { FontSizeToken, FontWeightToken, ColorToken } from '@bygsmart/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFontScale } from '../hooks/useFontScale';

export type TextVariant = 'display' | 'heading' | 'title' | 'body' | 'label' | 'caption';

const VARIANT: Record<TextVariant, { size: FontSizeToken; weight: FontWeightToken }> = {
  display: { size: '3xl', weight: 'bold' },
  heading: { size: '2xl', weight: 'bold' },
  title: { size: 'xl', weight: 'semibold' },
  body: { size: 'md', weight: 'regular' },
  label: { size: 'sm', weight: 'medium' },
  caption: { size: 'xs', weight: 'regular' },
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorToken;
  center?: boolean;
}

/**
 * Themed, Dynamic-Type-aware text. RN scales fontSize by the OS font scale; we scale
 * the (literal) lineHeight to match so large-text rhythm holds. a11y role inferred;
 * headings get the header role. `maxFontSizeMultiplier` is capped so extreme settings
 * can't shatter layouts (override per instance when a screen can take it).
 */
export function Text({
  variant = 'body',
  color = 'textPrimary',
  center,
  style,
  maxFontSizeMultiplier = 2,
  ...props
}: TextProps) {
  const t = useTheme();
  const fontScale = useFontScale();
  const v = VARIANT[variant];
  const cap = maxFontSizeMultiplier ?? 2;
  const cappedScale = Math.min(fontScale, cap);
  const isHeading = variant === 'display' || variant === 'heading' || variant === 'title';
  return (
    <RNText
      accessibilityRole={props.accessibilityRole ?? (isHeading ? 'header' : 'text')}
      maxFontSizeMultiplier={cap}
      style={[
        {
          color: t.colors[color],
          fontSize: t.fontSizes[v.size],
          fontWeight: t.fontWeights[v.weight],
          lineHeight: t.fontSizes[v.size] * t.lineHeights.normal * cappedScale,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
      {...props}
    />
  );
}
