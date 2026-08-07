import { Pressable, View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface ListItemProps extends Omit<ViewProps, 'children'> {
  title: string;
  subtitle?: string;
  /** Leading slot — a string glyph is rendered as text; any node (e.g. IconBubble) as-is. */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}

/** Row with leading glyph, title/subtitle, trailing slot. Pressable ⇒ button role, >=48dp. */
export function ListItem({ title, subtitle, leading, trailing, onPress, style, ...props }: ListItemProps) {
  const t = useTheme();
  const inner = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          minHeight: t.touchTarget.min,
          paddingVertical: t.spacing.sm,
        },
        style,
      ]}
      {...props}
    >
      {leading != null ? (
        typeof leading === 'string' ? (
          <Text style={{ fontSize: t.fontSizes.xl }}>{leading}</Text>
        ) : (
          leading
        )
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={(s) => ({ opacity: s.pressed ? 0.85 : 1 })}
    >
      {inner}
    </Pressable>
  );
}
