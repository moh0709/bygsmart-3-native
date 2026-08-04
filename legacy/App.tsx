
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation, Outlet, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
// Design System 2.0 living gallery (docs/UI_OVERHAUL_PLAN.md)
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
import BottomNavBar, { useProjectUnread } from './components/BottomNavBar';
import NavRail from './components/NavRail';
import ModuleGateFallback from './pages/ModuleGateFallback';
import { ChatProvider, ChatbotController } from './modules/ai';
import { useModuleEnabled } from './core/entitlements/EntitlementsProvider';
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ModuleMarketplacePage = lazy(() => import('./pages/ModuleMarketplacePage'));
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const LogPage = lazy(() => import('./pages/LogPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const CookiesPage = lazy(() => import('./pages/CookiesPage'));
const GdprPage = lazy(() => import('./pages/GdprPage'));
const DemoWelcomePage = lazy(() => import('./pages/DemoWelcomePage'));
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ToolAccessProvider } from './contexts/ToolAccessProvider';
import { EntitlementsProvider } from './core/entitlements/EntitlementsProvider';
import { OrgProvider } from './core/org/OrgProvider';
import { useSlot } from './core/registry/hooks';
import type { RouteContribution } from './core/registry/types';
import { ToastProvider } from './contexts/ToastContext';
import CookieConsentBanner from './components/CookieConsentBanner';
import { handleAuthCallback } from './modules/integrations';
import SaveStatusIndicator from './components/SaveStatusIndicator';
import MfaChallengeScreen from './components/auth/MfaChallengeScreen';
import GlobalTopBar from './components/GlobalTopBar';
import StorageUsageBanner from './components/org/StorageUsageBanner';


// Listens for Supabase PASSWORD_RECOVERY event and redirects to the reset-password route.
// This is needed because Supabase strips hash fragments from redirect_to in emails,
// so the recovery token lands on the root route instead of /#/reset-password.
const PasswordRecoveryRedirect: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                navigate('/reset-password', { replace: true });
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);
    return null;
};

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => {
        const result = handleAuthCallback();
        if (result) {
            localStorage.setItem(`bygSmart-${result.provider}-connected`, 'true');
            sessionStorage.setItem(`bygSmart-${result.provider}-token`, result.token);
            navigate('/settings');
        } else {
            navigate('/login');
        }
    }, [navigate]);
    return <div className="flex h-screen items-center justify-center">Forbinder konto...</div>;
}

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setTimedOut(true), 8_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (timedOut) return <Navigate to="/login" replace />;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-subtle dark:bg-bg-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Indlæser...</p>
        </div>
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setTimedOut(true), 8_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (timedOut) return <Navigate to="/login" replace />;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-subtle dark:bg-bg-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Indlæser...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.appRole !== 'admin') return <Navigate to="/home" replace />;
  return <Outlet />;
};


const MainLayout: React.FC = () => {
  const location = useLocation();
  const projectUnread = useProjectUnread();
  const aiEnabled = useModuleEnabled('ai');
  const noNavBarRoutes = ['/regulation', '/project-detail', '/task/', '/settings', '/team', '/logs', '/help', '/guide', '/projects/new'];
  
  const isToolDetail = location.pathname.startsWith('/tools/') && location.pathname !== '/tools/list';
  const usesAppViewport = location.pathname === '/projects/new';
  
  const showNavBar = !noNavBarRoutes.some(path => location.pathname.startsWith(path)) && !isToolDetail;

  return (
    <div className="font-sans text-text-primary dark:text-text-dark-primary bg-bg-subtle dark:bg-bg-dark min-h-screen transition-colors duration-300">
      <SaveStatusIndicator />
      {/* Global top bar: profile, subscription, notifications — fixed on every page. */}
      <GlobalTopBar />
      {/* ≥md: the rail owns reserved layout space; page content cannot extend beneath it. */}
      <NavRail projectUnread={projectUnread} />
      <main
        className={[
          'min-w-0 overflow-x-clip pt-topbar',
          'md:ml-[88px] md:w-[calc(100%-88px)]',
          usesAppViewport ? 'pb-0' : showNavBar ? 'pb-nav md:pb-24' : 'pb-24',
        ].join(' ')}
      >
        {/* Soft storage-quota warning (80/100 %) — never blocks anything. */}
        <StorageUsageBanner />
        <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <Outlet />
        </Suspense>
      </main>
      {showNavBar && <BottomNavBar projectUnread={projectUnread} />}
      {aiEnabled && <ChatbotController />}
      <div className="fixed bottom-2 right-2 text-xs text-text-tertiary/60 dark:text-text-dark-tertiary/60 z-10 pointer-events-none select-none">
        v1.0.1
      </div>
    </div>
  );
};

// Shared page-loading spinner for module-contributed routes.
const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// React.lazy wrappers must be stable across renders — cache them per path.
const moduleRouteCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();
const getModuleRouteComponent = (contribution: RouteContribution) => {
  let cached = moduleRouteCache.get(contribution.path);
  if (!cached) {
    cached = lazy(contribution.load);
    moduleRouteCache.set(contribution.path, cached);
  }
  return cached;
};

const AppRouter: React.FC = () => {
  const { mfaPending } = useAuth();

  // Module-contributed routes (only entitled modules' manifests survive the
  // registry's requires-closure filter, so a disabled module's deep links
  // fall through to NotFound).
  const moduleRoutes = useSlot('routes');

  // When a password-verified session still owes its second factor, block the
  // entire app (all routes) behind the TOTP challenge until it reaches aal2.
  // Rendered here rather than per-route so a mid-challenge refresh stays gated.
  if (mfaPending) {
    return <MfaChallengeScreen />;
  }

  return (
    <>
    <PasswordRecoveryRedirect />
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiesPage />} />
      <Route path="/gdpr" element={<GdprPage />} />
      <Route path="/" element={<Navigate to="/welcome" replace />} />

      <Route element={<ProtectedRoute />}>
        {/* Demo welcome step — signed in, but deliberately outside MainLayout
            so there is no nav chrome until the visitor has introduced themselves. */}
        <Route path="/demo-velkommen" element={<DemoWelcomePage />} />

        <Route element={<MainLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/design" element={
              <Suspense fallback={<PageLoader />}>
                <DesignSystemPage />
              </Suspense>
            } />
            {/* Kernel-hosted search shell — modules contribute searchSources;
                /regulation/:id + /guide/:guideId arrive via modules/knowledge. */}
            <Route path="/search" element={<SearchPage />} />
            {/* /tasks, /projects, /projects/new and /project-detail/:id arrive
                via the tasks/projects manifest routes. */}
            
            {/* Tools Navigation */}
            {/* ── Module-contributed routes (BYG 3.0 registry slot) ──────────
                Modules whose entitlement is on contribute lazy route subtrees;
                e.g. modules/tools carries /tools/* (~90 calculator routes,
                generated from ROUTE_DEFS — see modules/tools/loaders.ts). */}
            {moduleRoutes.map((contribution) => (
              <Route
                key={contribution.path}
                path={contribution.path}
                element={
                  <Suspense fallback={<PageLoader />}>
                    {React.createElement(getModuleRouteComponent(contribution))}
                  </Suspense>
                }
              />
            ))}

            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
            <Route path="/moduler" element={<ModuleMarketplacePage />} />
            <Route path="/moduler/:moduleId" element={<ModuleDetailPage />} />
            <Route path="/logs" element={<LogPage />} />
            <Route path="/help" element={<HelpPage />} />
        </Route>
      </Route>
      
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      {/* Locked-module deep links become a marketplace upsell; true unknowns 404. */}
      <Route path="*" element={<ModuleGateFallback />} />
    </Routes>
    </Suspense>
    </>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CookieConsentBanner />
        <ThemeProvider>
          <ToastProvider>
          <AuthProvider>
            <OrgProvider>
            <SubscriptionProvider>
              <EntitlementsProvider>
              <ToolAccessProvider>
              <ChatProvider>
                <AppRouter />
              </ChatProvider>
              </ToolAccessProvider>
              </EntitlementsProvider>
            </SubscriptionProvider>
            </OrgProvider>
          </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
    </HashRouter>
  );
};

export default App;
