// @bygsmart/tokens — the SINGLE source of design tokens (AR-04).
// Nothing else in the codebase defines a colour, spacing step, radius or type size.
// Values are adapted from the finished BygSmart 2.1 production design system (its
// `src/index.css` @theme) so the universal app inherits the real brand. Structured so
// NativeWind v5 (D-03) can consume these as a Tailwind v4 @theme once it leaves preview;
// until then primitives read them directly via the theme.

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

/** Radius scale — 2.1: control 10 (buttons/inputs), card 16, modal 24. */
export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
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

/**
 * Type ramp — the exact 2.1 scale (size / line-height / weight / letter-spacing).
 * Text reads this per-variant; the generic `fontSizes` scale above stays for one-off
 * uses (icon glyphs, control labels). Line-heights are literal px (RN); Text multiplies
 * them by the OS font scale to keep rhythm under Dynamic Type.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0 },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '400' as const, letterSpacing: 0.1 },
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Elevation — the depth 2.1 gives cards/buttons/sheets, expressed as RN shadow props
 * (iOS shadow* + Android elevation; RNW maps shadow* → box-shadow). This is what makes
 * surfaces read as product-grade instead of flat. Brand-tinted glow is derived per-theme
 * by the primitive from `colors.primary`, so it isn't baked here.
 */
export const elevation = {
  none: {},
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  raised: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  modal: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
  },
} as const;

export type ElevationToken = keyof typeof elevation;

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
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  /** Brand family — `primary` is the fill, `primaryStrong` the pressed state,
   *  `primarySubtle`/`primaryBorder` the tinted-surface pair (hero, links, chips). */
  primary: string;
  primaryText: string;
  primaryStrong: string;
  primarySubtle: string;
  primaryBorder: string;
  /** Status families — each carries a `*Subtle` bg + `*Strong` (AA text) + `*Border`,
   *  mirroring 2.1 so badges/alerts render as tinted surfaces, not solid blocks. */
  success: string;
  successStrong: string;
  successSubtle: string;
  successBorder: string;
  warning: string;
  warningStrong: string;
  warningSubtle: string;
  warningBorder: string;
  danger: string;
  dangerStrong: string;
  dangerSubtle: string;
  dangerBorder: string;
  info: string;
  infoStrong: string;
  infoSubtle: string;
  infoBorder: string;
  overlay: string;
  /** Pending/syncing accent for the never-lie-about-state UI (P3) — warning family. */
  pending: string;
}

export type ThemeName = 'light' | 'dark' | 'outdoor';

const light: ThemeColors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F4F7',
  border: '#E5E7EB',
  borderStrong: '#D0D5DD',
  textPrimary: '#101828',
  textSecondary: '#475467',
  textTertiary: '#98A2B3',
  textInverse: '#FFFFFF',
  primary: '#1E5FFF',
  primaryText: '#FFFFFF',
  primaryStrong: '#0E4AE8',
  primarySubtle: '#EFF4FF',
  primaryBorder: '#C7D7FE',
  success: '#1BB55C',
  successStrong: '#067647',
  successSubtle: '#E8F8EF',
  successBorder: '#B5E3C8',
  warning: '#F5A524',
  warningStrong: '#B54708',
  warningSubtle: '#FEF5E5',
  warningBorder: '#FFDFA3',
  danger: '#E5484D',
  dangerStrong: '#B42318',
  dangerSubtle: '#FDECEC',
  dangerBorder: '#F9C1BD',
  info: '#2E90FA',
  infoStrong: '#175CD3',
  infoSubtle: '#EAF3FF',
  infoBorder: '#B2DDFF',
  overlay: 'rgba(16,24,40,0.45)',
  pending: '#B54708',
};

const dark: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#28354A',
  border: '#334155',
  borderStrong: '#475569',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  primary: '#4C9AFF',
  primaryText: '#0F172A',
  primaryStrong: '#2E6FE0',
  primarySubtle: '#16234A',
  primaryBorder: '#2B3D6E',
  success: '#35C67E',
  successStrong: '#7EE7AC',
  successSubtle: '#0C2E1C',
  successBorder: '#1F5137',
  warning: '#E0A73B',
  warningStrong: '#F4C77A',
  warningSubtle: '#38290C',
  warningBorder: '#6B5220',
  danger: '#F0625B',
  dangerStrong: '#F6A19B',
  dangerSubtle: '#3A1416',
  dangerBorder: '#6E2A2A',
  info: '#4C9AFF',
  infoStrong: '#8EC0FF',
  infoSubtle: '#122742',
  infoBorder: '#26456E',
  overlay: 'rgba(0,0,0,0.6)',
  pending: '#F4C77A',
};

/** Outdoor high-contrast — sun, gloves, one hand (P6). Maximised contrast, heavier borders. */
const outdoor: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F0',
  border: '#000000',
  borderStrong: '#000000',
  textPrimary: '#000000',
  textSecondary: '#1A1A1A',
  textTertiary: '#333333',
  textInverse: '#FFFFFF',
  primary: '#0B4FB0',
  primaryText: '#FFFFFF',
  primaryStrong: '#083A82',
  primarySubtle: '#E4EEFB',
  primaryBorder: '#0B4FB0',
  success: '#0A6E3C',
  successStrong: '#064A28',
  successSubtle: '#E0F3E8',
  successBorder: '#0A6E3C',
  warning: '#8A5200',
  warningStrong: '#5E3800',
  warningSubtle: '#FBEFDD',
  warningBorder: '#8A5200',
  danger: '#A5201B',
  dangerStrong: '#741613',
  dangerSubtle: '#FBE3E2',
  dangerBorder: '#A5201B',
  info: '#0B4FB0',
  infoStrong: '#083A82',
  infoSubtle: '#E4EEFB',
  infoBorder: '#0B4FB0',
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
  typography: typeof typography;
  elevation: typeof elevation;
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
    typography,
    elevation,
    touchTarget,
  };
}

export type Breakpoint = keyof typeof breakpoints;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type FontSizeToken = keyof typeof fontSizes;
export type FontWeightToken = keyof typeof fontWeights;
export type ColorToken = keyof ThemeColors;
