import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { elevate } from '../theme/elevation';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/iconRegistry';

export type BubbleTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** 135° light→base gradient pairs + the shadow-tint base, adapted from 2.1's rich-bubble-*. */
const GRADIENTS: Record<Exclude<BubbleTone, 'neutral'>, { colors: [string, string]; shadow: string }> = {
  brand: { colors: ['#60A5FA', '#1E5FFF'], shadow: '#1E5FFF' },
  success: { colors: ['#34D399', '#1BB55C'], shadow: '#1BB55C' },
  warning: { colors: ['#FBBF50', '#F5A524'], shadow: '#F5A524' },
  danger: { colors: ['#F97066', '#E5484D'], shadow: '#E5484D' },
  info: { colors: ['#6BA6FF', '#2E90FA'], shadow: '#2E90FA' },
};

export interface IconBubbleProps {
  icon: IconName;
  tone?: BubbleTone;
  size?: number;
}

/**
 * The BygSmart "rich bubble" — a gradient-filled rounded icon tile with a tone-tinted lift
 * shadow and a white glyph. The signature visual of the 2.1 design; use it wherever a
 * flat emoji or grey square would otherwise sit (stat cards, list rows, action cards).
 * `neutral` stays a flat muted tile (the 2.1 `default` tone).
 */
export function IconBubble({ icon, tone = 'brand', size = 40 }: IconBubbleProps) {
  const t = useTheme();
  const glyph = Math.round(size * 0.55);
  const radius = t.radii.md;

  if (tone === 'neutral') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.surfaceAlt,
        }}
      >
        <Icon name={icon} size={glyph} color="textSecondary" />
      </View>
    );
  }

  const g = GRADIENTS[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        ...elevate({ shadowColor: g.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4 }),
      }}
    >
      <LinearGradient
        colors={g.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Icon name={icon} size={glyph} tint="#FFFFFF" />
    </View>
  );
}
