// Entitlement engine — harvested from legacy/server/moduleCatalog.js (pure, no I/O).
// In 2.1 this was duplicated across client (core/registry) and server (standalone deploy),
// pinned by parity tests. In 3.0 packages/core is the SINGLE source — this file reuses the
// one MODULE_IDS from the registry, so the duplication (and its parity tests) is gone.

import { MODULE_IDS, type ModuleId } from '../registry/types';
import { MODULE_INFO } from '../registry/moduleInfo';

export type Tier = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';
export type EntitlementSource = 'legacy' | 'grandfathered' | 'trial' | 'admin' | 'tier' | 'purchase';

export interface ModulePricing {
  name: string;
  priceKr: number;
}

/** Per-module storefront pricing (DKK/month per org) — the source of truth for Stripe checkout. */
export const MODULE_PRICING: Partial<Record<ModuleId, ModulePricing>> = {
  field: { name: 'Udførelse & Kommunikation', priceKr: 99 },
  quality: { name: 'KS & Aflevering', priceKr: 99 },
  time: { name: 'Tidsregistrering', priceKr: 79 },
  planning: { name: 'Plan & Kalender', priceKr: 59 },
  documents: { name: 'Dokumenter & Tegninger', priceKr: 69 },
  team: { name: 'Team & Adgang', priceKr: 59 },
  budget: { name: 'Budget & Økonomistyring', priceKr: 79 },
  purchasing: { name: 'Indkøb & Leverandører', priceKr: 69 },
  quotations: { name: 'Tilbud & Salg', priceKr: 79 },
  partners: { name: 'Partnere & Underentreprenører', priceKr: 99 },
  reporting: { name: 'Rapporter & Eksport', priceKr: 89 },
  'client-portal': { name: 'Kunde-portal', priceKr: 89 },
  ai: { name: 'AI-assistent', priceKr: 149 },
  ar: { name: 'AR & Opmåling', priceKr: 129 },
  integrations: { name: 'Integrationer & Data', priceKr: 59 },
};

/** Display name for every module — derived from MODULE_INFO (single source). */
export const MODULE_NAMES: Record<ModuleId, string> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, MODULE_INFO[id].name]),
) as Record<ModuleId, string>;

/**
 * Module dependencies — a module can only be purchased/trialled once every module it requires
 * is already entitled. Mirrors each manifest's `requires`; the app can assert parity against
 * ALL_MANIFESTS.
 */
export const MODULE_REQUIRES: Partial<Record<ModuleId, ModuleId[]>> = {
  ar: ['tools'],
  field: ['tasks'],
  'client-portal': ['projects'],
  quality: ['field'],
  quotations: ['reporting'],
};

export const TIER_ORDER: Tier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

/** Lowest tier that includes each module. A config row's min_tier overrides this. */
export const DEFAULT_MIN_TIER: Record<ModuleId, Tier> = {
  projects: 'FREE',
  tasks: 'FREE',
  tools: 'FREE',
  knowledge: 'FREE',
  field: 'PRO',
  quality: 'PRO',
  time: 'PRO',
  planning: 'PRO',
  documents: 'PRO',
  team: 'PRO',
  budget: 'PREMIUM',
  purchasing: 'PREMIUM',
  quotations: 'PREMIUM',
  partners: 'PREMIUM',
  reporting: 'PREMIUM',
  ai: 'PREMIUM',
  ar: 'PREMIUM',
  'client-portal': 'ENTERPRISE',
  integrations: 'ENTERPRISE',
};

/** True when `tier` is at or above `minTier` (unknown values fail open). */
export const tierIncludes = (tier: string, minTier: Tier | null | undefined): boolean => {
  if (!minTier) return true;
  const tierIdx = TIER_ORDER.indexOf(tier as Tier);
  const minIdx = TIER_ORDER.indexOf(minTier);
  if (tierIdx === -1 || minIdx === -1) return true;
  return tierIdx >= minIdx;
};

export interface ModuleAccessConfigRow {
  module_id: ModuleId;
  enabled?: boolean;
  min_tier?: Tier | null;
}

export interface OrgModuleEntitlementRow {
  module_id: ModuleId;
  status: string;
  valid_until?: string | null;
  source?: string;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
}

export interface ModuleEntitlement {
  enabled: boolean;
  source: EntitlementSource;
  validUntil: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
}

export interface ResolveModuleEntitlementsInput {
  /** Effective tier to gate against (org owner's, trial overlay applied). */
  tier: string;
  configRows?: ModuleAccessConfigRow[];
  /** Emergency override — false forces legacy all-on. */
  enforceTierMap: boolean;
  org?: { grandfathered?: boolean } | null;
  orgRows?: OrgModuleEntitlementRow[];
  /** Clock injection for tests. */
  now?: number;
}

export interface ResolveModuleEntitlementsResult {
  modules: Record<ModuleId, ModuleEntitlement>;
  source: 'db' | 'tier-map' | 'legacy';
}

/**
 * Resolve the effective module set for one caller. Pure — no I/O.
 * Precedence: kill-switch → override → no-org fail-open → grandfathered →
 * org row (disabled/enabled/trial+expiry) → tier map → fail-open.
 */
export const resolveModuleEntitlements = ({
  tier,
  configRows,
  enforceTierMap,
  org = null,
  orgRows = [],
  now = Date.now(),
}: ResolveModuleEntitlementsInput): ResolveModuleEntitlementsResult => {
  const configById = new Map((configRows ?? []).map((row) => [row.module_id, row]));
  const orgById = new Map((orgRows ?? []).map((row) => [row.module_id, row]));
  const modules = {} as Record<ModuleId, ModuleEntitlement>;

  for (const moduleId of MODULE_IDS) {
    const row = configById.get(moduleId) ?? null;

    if (row && row.enabled === false) {
      modules[moduleId] = { enabled: false, source: 'admin', validUntil: null };
      continue;
    }

    if (!enforceTierMap || !org) {
      modules[moduleId] = { enabled: true, source: 'legacy', validUntil: null };
      continue;
    }

    if (org.grandfathered) {
      modules[moduleId] = { enabled: true, source: 'grandfathered', validUntil: null };
      continue;
    }

    const orgRow = orgById.get(moduleId) ?? null;
    if (orgRow) {
      if (orgRow.status === 'disabled') {
        modules[moduleId] = { enabled: false, source: 'admin', validUntil: null };
        continue;
      }
      const until = orgRow.valid_until ? new Date(orgRow.valid_until).getTime() : null;
      const stillValid = until === null ? orgRow.status === 'enabled' : until > now;
      if (stillValid) {
        modules[moduleId] = {
          enabled: true,
          source: orgRow.status === 'trial' ? 'trial' : ((orgRow.source as EntitlementSource) || 'admin'),
          validUntil: orgRow.valid_until ?? null,
          cancelAtPeriodEnd: !!orgRow.cancel_at_period_end,
          currentPeriodEnd: orgRow.current_period_end ?? null,
        };
        continue;
      }
      // Expired trial/campaign — fall through to the tier map.
    }

    const minTier = (row && row.min_tier) || DEFAULT_MIN_TIER[moduleId] || null;
    modules[moduleId] = {
      enabled: tierIncludes(tier, minTier),
      source: 'tier',
      validUntil: null,
    };
  }

  const source =
    !enforceTierMap || !org ? 'legacy' : configById.size > 0 || orgById.size > 0 ? 'db' : 'tier-map';
  return { modules, source };
};
