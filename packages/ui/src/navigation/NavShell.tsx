import { type ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Text } from '../primitives/Text';

export interface NavItem {
  key: string;
  label: string;
  icon: string;
}

export interface NavShellProps {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}

/**
 * One UI, three shapes (H-01 / D-05):
 *  - phone   → bottom tab bar
 *  - tablet  → icon rail
 *  - desktop → rail with labels
 * Registry-driven: `items` come from the module registry (packages/core) in P5.
 */
export function NavShell({ items, activeKey, onSelect, children }: NavShellProps) {
  const t = useTheme();
  const { isTabletUp, isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();

  if (isTabletUp) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.colors.background }}>
        <View
          style={{
            width: isDesktop ? 220 : 80,
            paddingTop: insets.top + t.spacing.md,
            paddingHorizontal: t.spacing.sm,
            gap: t.spacing.xs,
            backgroundColor: t.colors.surface,
            borderRightWidth: 1,
            borderRightColor: t.colors.border,
          }}
        >
          {items.map((it) => (
            <NavButton key={it.key} item={it} active={it.key === activeKey} expanded={isDesktop} orientation="rail" onPress={() => onSelect(it.key)} />
          ))}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ flex: 1 }}>{children}</View>
      <View
        style={{
          flexDirection: 'row',
          paddingBottom: insets.bottom,
          backgroundColor: t.colors.surface,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
        }}
      >
        {items.map((it) => (
          <NavButton key={it.key} item={it} active={it.key === activeKey} expanded orientation="tab" onPress={() => onSelect(it.key)} />
        ))}
      </View>
    </View>
  );
}

function NavButton({
  item,
  active,
  expanded,
  orientation,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  orientation: 'tab' | 'rail';
  onPress: () => void;
}) {
  const t = useTheme();
  const color = active ? t.colors.primary : t.colors.textSecondary;
  const isTab = orientation === 'tab';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      onPress={onPress}
      style={{
        minHeight: t.touchTarget.min,
        flex: isTab ? 1 : undefined,
        flexDirection: isTab ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: isTab ? 'center' : 'flex-start',
        gap: isTab ? 2 : t.spacing.sm,
        paddingVertical: t.spacing.sm,
        paddingHorizontal: isTab ? t.spacing.xs : t.spacing.sm,
        borderRadius: isTab ? 0 : t.radii.md,
        backgroundColor: active && !isTab ? t.colors.surfaceAlt : 'transparent',
      }}
    >
      <Text style={{ fontSize: 20, color }}>{item.icon}</Text>
      {expanded ? (
        <Text variant="caption" style={{ color, fontWeight: active ? t.fontWeights.semibold : t.fontWeights.regular }}>
          {item.label}
        </Text>
      ) : null}
    </Pressable>
  );
}
