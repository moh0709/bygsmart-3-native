import { useWindowDimensions } from 'react-native';

/**
 * The OS font-scale multiplier (Dynamic Type / Android font size). RN auto-scales
 * a Text's fontSize by this; line height is a literal that does NOT auto-scale, so
 * primitives multiply their computed lineHeight by this to keep the rhythm as text
 * grows. On web this is 1 (the browser's own zoom handles accessibility).
 */
export function useFontScale(): number {
  const { fontScale } = useWindowDimensions();
  return fontScale || 1;
}
