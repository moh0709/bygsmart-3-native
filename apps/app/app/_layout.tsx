import { Slot, useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, NavShell, type NavItem } from '@bygsmart/ui';

// Placeholder nav set. In P5 this is derived from the module registry (packages/core).
const NAV: (NavItem & { route: Href })[] = [
  { key: 'index', label: 'Hjem', icon: '🏠', route: '/' },
  { key: 'projects', label: 'Projekter', icon: '🏗️', route: '/projects' },
  { key: 'tasks', label: 'Opgaver', icon: '☑️', route: '/tasks' },
  { key: 'more', label: 'Mere', icon: '⋯', route: '/more' },
];

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
