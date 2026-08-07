import { Pressable, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { elevate } from '../theme/elevation';

export type HeroVariant = 'brand' | 'ai';

export interface HeroCardProps extends ViewProps {
  variant?: HeroVariant;
  onPress?: () => void;
  padded?: boolean;
}

/**
 * Full-colour signature surface — the 2.1 `rich-hero-brand` / `rich-hero-ai` cards
 * (project hero, AI briefing). A diagonal multi-stop gradient + a soft corner glow +
 * a tinted lift shadow. Content placed inside should be light (white) — the screen
 * composes it. Becomes a button when onPress is given.
 */
export function HeroCard({ variant = 'brand', onPress, padded = true, style, children, ...props }: HeroCardProps) {
  const t = useTheme();
  const colors: [string, string, string] =
    variant === 'ai' ? ['#4F46E5', '#7C3AED', '#9333EA'] : [t.colors.primary, t.colors.primaryStrong, '#0A3AC2'];
  const shadowColor = variant === 'ai' ? '#7C3AED' : t.colors.primary;

  const base = {
    borderRadius: t.radii.lg,
    overflow: 'hidden' as const,
    ...(padded && { padding: t.spacing.lg }),
    ...elevate({ shadowColor, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 8 }),
  };

  const fill = (
    <>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Soft corner light-glow (approximates the 2.1 rich-glow radial). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -60,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: 'rgba(255,255,255,0.14)',
        }}
      />
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={(s) => [base, { opacity: s.pressed ? 0.95 : 1 }, style as object]}>
        {fill}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...props}>
      {fill}
    </View>
  );
}
