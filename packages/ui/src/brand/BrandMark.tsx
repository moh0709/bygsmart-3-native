import Svg, { Path } from 'react-native-svg';

export interface BrandMarkProps {
  size?: number;
  /** Stroke colour of the mark. Defaults to white (sits inside a brand-filled tile). */
  color?: string;
}

/**
 * The BygSmart logo mark — two overlapping house/building silhouettes, adapted verbatim
 * from the 2.1 production login. Universal (react-native-svg → real <svg> on web, native
 * paths on device). Pair it with the "BYG SMART" wordmark for the full lockup.
 *
 * NOTE: like Icon, this imports react-native-svg's native build, which does not load under
 * jsdom — verify via the expo web export / emulator, not the layer-7 render harness.
 */
export function BrandMark({ size = 30, color = '#FFFFFF' }: BrandMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      accessibilityLabel="BygSmart"
    >
      <Path
        d="M5 15.75L12.5 9.375L20 15.75V25H5V15.75Z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.25 25V13.75L21.25 10L26.25 13.75V25H16.25Z"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
