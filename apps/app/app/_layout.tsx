import { Slot, useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, NavShell, type NavItem } from '@bygsmart/ui';
import { resolveActiveManifests, collectSlot, computeEnabledModules } from '@bygsmart/core';
import { ALL_MANIFESTS } from '../src/registry/manifests';

interface ShellNav extends NavItem {
  route: Href;
  order: number;
}

// Kernel nav frames the registry-contributed items (home + more are not modules).
const KERNEL: ShellNav[] = [
  { key: 'index', label: 'Hjem', icon: '🏠', route: '/', order: 0 },
  { key: 'more', label: 'Mere', icon: '⋯', route: '/more', order: 99 },
];

// The real pipeline: entitlements → enabled set → requires-closure → slot collection.
// No backend yet, so entitlements fail open (all modules enabled); the mechanism is the point —
// disabling/gating a module removes its nav item without touching the shell.
function buildNav(): ShellNav[] {
  const enabled = computeEnabledModules(null);
  const active = resolveActiveManifests(enabled, ALL_MANIFESTS);
  const fromRegistry: ShellNav[] = collectSlot(active, 'nav').map((c) => ({
    key: c.to,
    label: c.label,
    icon: c.icon,
    route: c.to as Href,
    order: c.order,
  }));
  return [...KERNEL, ...fromRegistry].sort((a, b) => a.order - b.order);
}

const NAV = buildNav();

function Shell() {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = NAV.find((n) => n.route === pathname)?.key ?? 'index';
  return (
    <NavShell
      items={NAV}
      activeKey={activeKey}
      onSelect={(key) => {
        const item = NAV.find((n) => n.key === key);
        if (item) router.navigate(item.route);
      }}
    >
      <Slot />
    </NavShell>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
