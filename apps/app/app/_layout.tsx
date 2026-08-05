import { useMemo } from 'react';
import { Slot, useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, NavShell, type NavItem } from '@bygsmart/ui';
import { resolveActiveManifests, collectSlot, computeEnabledModules } from '@bygsmart/core';
import { I18nProvider, useTranslation } from '@bygsmart/i18n';
import { ALL_MANIFESTS } from '../src/registry/manifests';

interface ShellNav extends NavItem {
  route: Href;
  order: number;
}

type TFn = ReturnType<typeof useTranslation>['t'];

// The real pipeline: entitlements → enabled set → requires-closure → slot collection.
// No backend yet, so entitlements fail open (all modules enabled); the mechanism is the point —
// disabling/gating a module removes its nav item without touching the shell.
//
// Kernel nav (home + more) frames the registry items and is translated; module
// labels stay the manifest's Danish display name (the ModuleManifest contract).
function buildNav(t: TFn): ShellNav[] {
  const kernel: ShellNav[] = [
    { key: 'index', label: t('nav.home'), icon: '🏠', route: '/', order: 0 },
    { key: 'more', label: t('nav.more'), icon: '⋯', route: '/more', order: 99 },
  ];
  const enabled = computeEnabledModules(null);
  const active = resolveActiveManifests(enabled, ALL_MANIFESTS);
  const fromRegistry: ShellNav[] = collectSlot(active, 'nav').map((c) => ({
    key: c.to,
    label: c.label,
    icon: c.icon,
    route: c.to as Href,
    order: c.order,
  }));
  return [...kernel, ...fromRegistry].sort((a, b) => a.order - b.order);
}

function Shell() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const nav = useMemo(() => buildNav(t), [t]);
  const activeKey = nav.find((n) => n.route === pathname)?.key ?? 'index';
  return (
    <NavShell
      items={nav}
      activeKey={activeKey}
      onSelect={(key) => {
        const item = nav.find((n) => n.key === key);
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
      <I18nProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
