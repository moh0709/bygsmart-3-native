import React, { Suspense, lazy, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ROUTE_DEFS } from './loaders';
import { ProtectedToolRoute } from './components/ProtectedToolRoute';

/**
 * ToolsRoutes — the generated /tools/* route tree (Phase 4 extraction).
 * Replaces the ~90 hand-written <Route> entries in App.tsx: every entry in
 * ROUTE_DEFS becomes a lazy route, Pro-gated ones wrapped in
 * ProtectedToolRoute exactly as before. Deep links are unchanged because the
 * paths come from the same inventory (guarded by routes.parity.test.ts).
 */

const CalcFallback = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Indlæser beregner...</p>
    </div>
  </div>
);

const ToolsConfiguratorPage = lazy(() => import('./pages/ToolsConfiguratorPage'));
const CalculationToolsPage = lazy(() => import('./pages/CalculationToolsPage'));

const ToolsRoutes: React.FC = () => {
  // Lazy components are created once per mount tree — memo so re-renders
  // don't re-instantiate React.lazy wrappers.
  const routeElements = useMemo(
    () =>
      ROUTE_DEFS.map((def) => {
        const Component = lazy(def.load);
        const element = def.toolId ? (
          <ProtectedToolRoute toolId={def.toolId}>
            <Component />
          </ProtectedToolRoute>
        ) : (
          <Component />
        );
        return <Route key={def.path} path={def.path} element={element} />;
      }),
    []
  );

  return (
    <Suspense fallback={<CalcFallback />}>
      <Routes>
        {/* /tools (workflow configurator) + /tools/list (full catalog) */}
        <Route path="" element={<ToolsConfiguratorPage />} />
        <Route path="list" element={<CalculationToolsPage />} />
        {routeElements}
      </Routes>
    </Suspense>
  );
};

export default ToolsRoutes;
