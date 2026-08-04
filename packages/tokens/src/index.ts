// @bygsmart/tokens — the SINGLE source of design tokens (AR-04).
// Nothing else in the codebase defines a colour, spacing step, radius or type size.
// Structured so NativeWind v5 (D-03) can consume these as a Tailwind v4 @theme once it
// leaves preview; until then primitives read them directly via the theme.

// ─── Scales (theme-independent) ───────────────────────────────────────────────

/** 4px base spacing scale. Touch targets stay >= touchTarget.min (P6, gloves). */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

/** dp breakpoints — one UI, three shapes (P7 / D-05). */
export const breakpoints = {
  phone: 0,
  tablet: 600,
  desktop: 1024,
} as const;

/** >= 48dp targets everywhere (P6). */
export const touchTarget = { min: 48 } as const;

export const durations = { fast: 120, normal: 200, slow: 320 } as const;

// ─── Semantic colour roles (per theme) ────────────────────────────────────────

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
  /** Pending/syncing accent for the never-lie-about-state UI (P3). */
  pending: string;
}

export type ThemeName = 'light' | 'dark' | 'outdoor';

const light: ThemeColors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#D3D9E0',
  textPrimary: '#131820',
  textSecondary: '#5A6472',
  textInverse: '#FFFFFF',
  primary: '#1D6FE0',
  primaryText: '#FFFFFF',
  success: '#1B9E58',
  warning: '#C97A0A',
  danger: '#D23A34',
  info: '#1D6FE0',
  overlay: 'rgba(19,24,32,0.45)',
  pending: '#C97A0A',
};

const dark: ThemeColors = {
  background: '#0E1218',
  surface: '#171D26',
  surfaceAlt: '#212934',
  border: '#333D4A',
  textPrimary: '#F3F5F8',
  textSecondary: '#9AA6B4',
  textInverse: '#0E1218',
  primary: '#4C9AFF',
  primaryText: '#0E1218',
  success: '#35C67E',
  warning: '#E0A73B',
  danger: '#F0625B',
  info: '#4C9AFF',
  overlay: 'rgba(0,0,0,0.6)',
  pending: '#E0A73B',
};

/** Outdoor high-contrast — sun, gloves, one hand (P6). Maximised contrast, heavier borders. */
const outdoor: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F0',
  border: '#000000',
  textPrimary: '#000000',
  textSecondary: '#1A1A1A',
  textInverse: '#FFFFFF',
  primary: '#0B4FB0',
  primaryText: '#FFFFFF',
  success: '#0A6E3C',
  warning: '#8A5200',
  danger: '#A5201B',
  info: '#0B4FB0',
  overlay: 'rgba(0,0,0,0.6)',
  pending: '#8A5200',
};

export const themes: Record<ThemeName, ThemeColors> = { light, dark, outdoor };

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSizes: typeof fontSizes;
  fontWeights: typeof fontWeights;
  lineHeights: typeof lineHeights;
  touchTarget: typeof touchTarget;
}

export function makeTheme(name: ThemeName): Theme {
  return {
    name,
    colors: themes[name],
    spacing,
    radii,
    fontSizes,
    fontWeights,
    lineHeights,
    touchTarget,
  };
}

export type Breakpoint = keyof typeof breakpoints;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
export type ColorToken = keyof ThemeColors;
