import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { ColorToken, TypographyVariant } from '@bygsmart/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useFontScale } from '../hooks/useFontScale';

/** Text variants map 1:1 onto the token type ramp (2.1 scale). */
export type TextVariant = TypographyVariant;

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
  const v = t.typography[variant];
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
          fontSize: v.fontSize,
          fontWeight: v.fontWeight,
          // lineHeight is literal px; scale it with Dynamic Type so rhythm holds.
          lineHeight: v.lineHeight * cappedScale,
          letterSpacing: v.letterSpacing,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
      {...props}
    />
  );
}
