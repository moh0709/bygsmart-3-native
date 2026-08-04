// ─────────────────────────────────────────────────────────────────────────────
// ModuleGate — entitlement gating for content EMBEDDED inside an already-
// unlocked page/tab (as opposed to nav/route/tab-level gating, which
// core/registry/registry.ts already handles via resolveActiveManifests).
//
// Route/nav/tab gating only covers a module's OWN surfaces. The moment module
// A's page imports and renders a piece of module B (a KPI tile, an AI card,
// an Excel-export button, a modal), that embedded content needs its own
// check — this is that check, plus the three visual fallbacks used across the
// app: hide (render nothing), upsell (compact "requires module X" card), and
// inline-lock (a small lock badge for menu-item-shaped locations).
//
// Mirrors modules/tools/components/ProToolGate.tsx's visual vocabulary (that
// component gates individual Pro-tier calculators — a different, older
// mechanism — not module entitlements).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useModuleEnabled } from './EntitlementsProvider';
import type { ModuleId } from '../registry/types';
import { MODULE_INFO } from '../registry/moduleInfo';
import { MODULE_ICONS } from '../../components/marketplace/moduleIcons';
import { Badge, Button, Card, cn } from '../../components/ui';
import { LockIcon } from '../../components/icons';

/** Imperative equivalent of <ModuleGate> for guard clauses in handlers/effects. */
export const useModuleGate = (moduleId: ModuleId): boolean => useModuleEnabled(moduleId);

// ── Upsell card ─────────────────────────────────────────────────────────────

interface ModuleUpsellCardProps {
  moduleId: ModuleId;
  /** Compact = one-line row (for embedding inside an existing card/list). Full = standalone block. */
  compact?: boolean;
  className?: string;
}

export const ModuleUpsellCard: React.FC<ModuleUpsellCardProps> = ({ moduleId, compact = false, className }) => {
  const navigate = useNavigate();
  const info = MODULE_INFO[moduleId];
  const Icon = MODULE_ICONS[moduleId];
  const goToModule = () => navigate(`/moduler/${moduleId}`);

  if (compact) {
    return (
      <Card padding="sm" className={cn('flex items-center gap-3', className)}>
        <span
          className="flex w-9 h-9 shrink-0 items-center justify-center rounded-card bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light"
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate">
            Kræver {info.name}
          </p>
          <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">
            {info.description}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={goToModule}>
          Se modul
        </Button>
      </Card>
    );
  }

  return (
    <Card padding="lg" className={className}>
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-brand-subtle dark:bg-brand-subtle-dark flex items-center justify-center mb-3">
          <LockIcon className="w-6 h-6 text-brand-primary dark:text-brand-light" aria-hidden="true" />
        </div>
        <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Kræver {info.name}</h3>
        <p className="mt-1 text-label text-text-secondary dark:text-text-dark-secondary">{info.description}</p>
      </div>
      <Button fullWidth className="mt-5" onClick={goToModule}>
        Se modulet i butikken
      </Button>
    </Card>
  );
};

export const ModuleLockBadge: React.FC<{ moduleId: ModuleId; className?: string }> = ({ moduleId, className }) => {
  const info = MODULE_INFO[moduleId];
  return (
    <Badge variant="neutral" className={className}>
      <LockIcon className="w-3 h-3" aria-hidden="true" />
      {info.name}
    </Badge>
  );
};

// ── Gate ─────────────────────────────────────────────────────────────────────

interface ModuleGateProps {
  moduleId: ModuleId;
  /**
   * hide (default) — render nothing when locked; use for small embedded
   * tiles/widgets where the surrounding layout tolerates the gap.
   * upsell — compact "requires module X" card with a link to the storefall;
   * use for primary/marketed embedded features (AI cards, export buttons).
   * inline-lock — small lock badge; use for menu-item-shaped locations.
   */
  mode?: 'hide' | 'upsell' | 'inline-lock';
  /** Custom fallback overrides `mode`'s default fallback entirely. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const ModuleGate: React.FC<ModuleGateProps> = ({ moduleId, mode = 'hide', fallback, children }) => {
  const enabled = useModuleEnabled(moduleId);
  if (enabled) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  if (mode === 'hide') return null;
  if (mode === 'inline-lock') return <ModuleLockBadge moduleId={moduleId} />;
  return <ModuleUpsellCard moduleId={moduleId} compact />;
};

export default ModuleGate;
