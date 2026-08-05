// The icon NAME vocabulary — deliberately free of react-native-svg so the guard
// and the name type can be imported (and unit-tested) without pulling the native
// SVG renderer into a consumer's bundle/test. Icon.tsx maps these names to geometry
// and is the only file that imports react-native-svg.
export const ICON_NAMES = [
  'home',
  'more',
  'projects',
  'tasks',
  'plus',
  'search',
  'settings',
  'close',
  'chevronRight',
  'check',
  'warning',
  'sync',
  'user',
  'calendar',
  'clock',
  'camera',
  'document',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** True when `name` is a known icon (lets callers fall back to text/emoji). */
export function isIconName(name: string): name is IconName {
  return (ICON_NAMES as readonly string[]).includes(name);
}
