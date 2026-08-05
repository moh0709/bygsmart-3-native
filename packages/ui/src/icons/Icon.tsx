import { Fragment, type ReactNode } from 'react';
import Svg, { Path, Line, Circle, Rect, Polyline, Polygon } from 'react-native-svg';
import { useTheme, type Theme } from '../theme/ThemeProvider';
import type { IconName } from './iconRegistry';

// Stroke-based line icons (24×24, Feather geometry). Each entry is the inner
// geometry; <Icon> supplies the sized, coloured <Svg> wrapper. Names come from
// iconRegistry (the module registry's string `icon` fields resolve against it —
// the 1.3 core change made NavContribution.icon a name, not a DOM component).
// Typed as Record<IconName, …> so a name added to the registry MUST get geometry.
const ICONS: Record<IconName, ReactNode> = {
  home: (
    <Fragment>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Fragment>
  ),
  more: (
    <Fragment>
      <Circle cx="5" cy="12" r="1.6" />
      <Circle cx="12" cy="12" r="1.6" />
      <Circle cx="19" cy="12" r="1.6" />
    </Fragment>
  ),
  projects: (
    <Fragment>
      <Polygon points="12 2 2 7 12 12 22 7 12 2" />
      <Polyline points="2 17 12 22 22 17" />
      <Polyline points="2 12 12 17 22 12" />
    </Fragment>
  ),
  tasks: (
    <Fragment>
      <Polyline points="9 11 12 14 22 4" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Fragment>
  ),
  plus: (
    <Fragment>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Fragment>
  ),
  search: (
    <Fragment>
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Fragment>
  ),
  settings: (
    <Fragment>
      <Line x1="4" y1="21" x2="4" y2="14" />
      <Line x1="4" y1="10" x2="4" y2="3" />
      <Line x1="12" y1="21" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12" y2="3" />
      <Line x1="20" y1="21" x2="20" y2="16" />
      <Line x1="20" y1="12" x2="20" y2="3" />
      <Line x1="1" y1="14" x2="7" y2="14" />
      <Line x1="9" y1="8" x2="15" y2="8" />
      <Line x1="17" y1="16" x2="23" y2="16" />
    </Fragment>
  ),
  close: (
    <Fragment>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Fragment>
  ),
  chevronRight: <Polyline points="9 18 15 12 9 6" />,
  check: <Polyline points="20 6 9 17 4 12" />,
  warning: (
    <Fragment>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Fragment>
  ),
  sync: (
    <Fragment>
      <Polyline points="23 4 23 10 17 10" />
      <Polyline points="1 20 1 14 7 14" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Fragment>
  ),
  user: (
    <Fragment>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Fragment>
  ),
  calendar: (
    <Fragment>
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Fragment>
  ),
  clock: (
    <Fragment>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </Fragment>
  ),
  camera: (
    <Fragment>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Fragment>
  ),
  document: (
    <Fragment>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
      <Line x1="10" y1="9" x2="8" y2="9" />
    </Fragment>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Theme colour token; defaults to the primary text colour. */
  color?: keyof Theme['colors'];
  /** Decorative by default (hidden from a11y); pass a label to announce it. */
  label?: string;
}

/** Universal line icon (react-native-svg → real <svg> on web). */
export function Icon({ name, size = 24, color = 'textPrimary', label }: IconProps) {
  const t = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={t.colors[color]}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole={label ? 'image' : 'none'}
      accessibilityLabel={label}
      aria-hidden={label ? undefined : true}
    >
      {ICONS[name]}
    </Svg>
  );
}
