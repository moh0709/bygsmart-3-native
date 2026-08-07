import { Platform } from 'react-native';

interface ShadowLike {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Cross-platform elevation. RNW 0.21 deprecates the `shadow*` style props in favour of
 * CSS `boxShadow`, so on web we emit a single `boxShadow` string; on native we keep the
 * `shadow*` + Android `elevation` object verbatim. Accepts any elevation token value or an
 * inline shadow (the primary-button glow), including ones with a themed shadowColor.
 */
export function elevate(s: ShadowLike): object {
  if (!s || !s.shadowColor) return {};
  if (Platform.OS !== 'web') return s;
  const o = s.shadowOffset ?? { width: 0, height: 0 };
  return {
    boxShadow: `${o.width}px ${o.height}px ${s.shadowRadius ?? 0}px rgba(${hexToRgb(s.shadowColor)}, ${s.shadowOpacity ?? 0})`,
  };
}
