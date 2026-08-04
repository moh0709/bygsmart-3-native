import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { FontSizeToken, FontWeightToken, ColorToken } from '@bygsmart/tokens';
import { useTheme } from '../theme/ThemeProvider';

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

/** Themed, Dynamic-Type-friendly text. a11y role inferred; headings get header role. */
export function Text({ variant = 'body', color = 'textPrimary', center, style, ...props }: TextProps) {
  const t = useTheme();
  const v = VARIANT[variant];
  const isHeading = variant === 'display' || variant === 'heading' || variant === 'title';
  return (
    <RNText
      accessibilityRole={props.accessibilityRole ?? (isHeading ? 'header' : 'text')}
      style={[
        {
          color: t.colors[color],
          fontSize: t.fontSizes[v.size],
          fontWeight: t.fontWeights[v.weight],
          lineHeight: t.fontSizes[v.size] * t.lineHeights.normal,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
      {...props}
    />
  );
}
