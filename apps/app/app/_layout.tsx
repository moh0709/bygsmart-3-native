import { useMemo } from 'react';
import { Slot, useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, NavShell, Screen, Spinner, type NavItem } from '@bygsmart/ui';
import { resolveActiveManifests, collectSlot, computeEnabledModules } from '@bygsmart/core';
import { I18nProvider, useTranslation } from '@bygsmart/i18n';
import { AuthProvider, useSession } from '@bygsmart/api-client';
import { RepositoryProvider, readSyncBaseUrl, type BackendConfig } from '../src/db/react';
import { authClient } from '../src/auth/client';
import { LoginScreen } from '../src/screens/LoginScreen';
import { MfaChallengeScreen } from '../src/screens/MfaChallengeScreen';
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
    { key: 'index', label: t('nav.home'), icon: 'home', route: '/', order: 0 },
    { key: 'more', label: t('nav.more'), icon: 'more', route: '/more', order: 99 },
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

/** The signed-in app: builds the backend wiring from the live session and mounts the
 * repository + shell. Rendered only past the auth gate, so a session is present. */
function AuthedApp() {
  const { session, getToken } = useSession();
  const baseUrl = readSyncBaseUrl();
  const backend: BackendConfig | null =
    baseUrl && session ? { baseUrl, getToken, userId: session.user.id } : null;
  return (
    <RepositoryProvider backend={backend}>
      <Shell />
    </RepositoryProvider>
  );
}

/** Auth gate: while a backend is configured, require sign-in; otherwise (offline-first
 * dev with no Supabase) go straight in. */
function Gate() {
  const { isLoading, session, mfaPending } = useSession();
  const backendConfigured = !!readSyncBaseUrl();
  if (isLoading) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  // A half-authenticated session (password OK, second factor still owed) → challenge.
  if (session && mfaPending) return <MfaChallengeScreen />;
  if (backendConfigured && !session) return <LoginScreen />;
  return <AuthedApp />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          {authClient ? (
            <AuthProvider client={authClient}>
              <Gate />
            </AuthProvider>
          ) : (
            // No Supabase configured → offline-first, no login.
            <RepositoryProvider backend={null}>
              <Shell />
            </RepositoryProvider>
          )}
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
