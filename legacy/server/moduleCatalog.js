// ─────────────────────────────────────────────────────────────────────────────
// Module catalog — the 19 canonical module ids + tier map for the BYG 3.0
// entitlement engine, plus the pure resolution function used by
// server/routes/moduleEntitlementRoutes.js.
//
// The client keeps its own copy of the ids in core/registry/types.ts
// (ModuleId) — the backend deploys as a standalone directory and cannot
// import outside server/, so the duplication is deliberate (same pattern as
// server/taskInviteAccess.js). Keep both lists in sync.
// ─────────────────────────────────────────────────────────────────────────────

export const MODULE_IDS = [
  'projects',
  'tasks',
  'tools',
  'knowledge',
  'field',
  'quality',
  'time',
  'planning',
  'documents',
  'team',
  'budget',
  'purchasing',
  'quotations',
  'partners',
  'reporting',
  'client-portal',
  'ai',
  'ar',
  'integrations',
];

// Per-module storefront pricing (DKK/month per organisation) + Danish
// product names — the SERVER source of truth for Stripe checkout. The
// frontend core/registry/marketplaceCatalog.ts mirrors the prices for
// display; modulePricing.parity.test.ts pins the two in sync.
export const MODULE_PRICING = {
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

// Display names for ALL modules (MODULE_PRICING only covers paid ones) — used
// in "requires module X" messaging. Mirrors core/registry/moduleInfo.ts.
export const MODULE_NAMES = {
  projects: 'Projekter',
  tasks: 'Opgaver',
  tools: 'Beregnere & Værktøjer',
  knowledge: 'Viden & Reglement',
  ...Object.fromEntries(Object.entries(MODULE_PRICING).map(([id, p]) => [id, p.name])),
};

// Module dependencies — a module can only be purchased/trialled once every
// module it requires is already entitled for the org. The frontend registry
// (modules/<id>/manifest.ts `requires`) is the source of truth for nav/route/
// tab-level gating; this is the server's mirror (standalone-deploy
// constraint, same as MODULE_IDS above) used to block checkout/trial.
// server/moduleRequires.parity.test.ts pins the two in sync.
export const MODULE_REQUIRES = {
  ar: ['tools'],
  field: ['tasks'],
  'client-portal': ['projects'],
  quality: ['field'],
  quotations: ['reporting'],
};

export const TIER_ORDER = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

// Lowest tier that includes each module (PRD §6 growth path). Applies only to
// orgs created after marketplace launch — existing (grandfathered) orgs keep
// everything. A module_access_configs row's min_tier overrides this default.
export const DEFAULT_MIN_TIER = {
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
export const tierIncludes = (tier, minTier) => {
  if (!minTier) return true;
  const tierIdx = TIER_ORDER.indexOf(tier);
  const minIdx = TIER_ORDER.indexOf(minTier);
  if (tierIdx === -1 || minIdx === -1) return true;
  return tierIdx >= minIdx;
};

/**
 * Resolve the effective module set for one caller. Pure — no I/O.
 *
 * Precedence (Phase 3 — final shape, PRD §10.6):
 *   1. Global kill-switch: module_access_configs row with enabled=false →
 *      OFF for everyone. The only fail-closed path, admin-only.
 *   2. enforceTierMap=false → ON, source 'legacy'. Emergency override only
 *      (MODULE_TIER_MAP_ENFORCED=false in the server env).
 *   3. No org context (lookup failed / no active org) → ON, 'legacy'
 *      (fail-open — an org-resolution outage must never hide capability).
 *   4. org.grandfathered → ON, 'grandfathered' (every org backfilled before
 *      the marketplace launch keeps every module forever).
 *   5. org_module_entitlements row:
 *        status 'disabled'                      → OFF, 'admin'
 *        status 'enabled'|'trial', valid_until in the future (or null for
 *        'enabled')                             → ON, row.source
 *        expired valid_until                    → fall through to tier map
 *   6. Tier map: min_tier from the global config row (falling back to
 *      DEFAULT_MIN_TIER) vs the ORG's tier (its owner's effective tier).
 *   7. Anything unknown → ON (fail-open).
 *
 * @param {Object}  opts
 * @param {string}  opts.tier           Effective tier to gate against (org owner's, trial overlay applied).
 * @param {Array}   opts.configRows     Rows from module_access_configs (may be empty).
 * @param {boolean} opts.enforceTierMap Emergency override — false forces legacy all-on.
 * @param {Object|null} opts.org        { grandfathered } for the caller's active org, or null.
 * @param {Array}   opts.orgRows        Rows from org_module_entitlements for that org.
 * @param {number}  [opts.now]          Clock injection for tests.
 * @returns {{ modules: Object, source: 'db'|'tier-map'|'legacy' }}
 */
export const resolveModuleEntitlements = ({
  tier,
  configRows,
  enforceTierMap,
  org = null,
  orgRows = [],
  now = Date.now(),
}) => {
  const configById = new Map((configRows || []).map((row) => [row.module_id, row]));
  const orgById = new Map((orgRows || []).map((row) => [row.module_id, row]));
  const modules = {};

  for (const moduleId of MODULE_IDS) {
    const row = configById.get(moduleId) || null;

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

    const orgRow = orgById.get(moduleId) || null;
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
          source: orgRow.status === 'trial' ? 'trial' : (orgRow.source || 'admin'),
          validUntil: orgRow.valid_until ?? null,
          // A purchase pending graceful cancellation (native in-app cancel) —
          // the UI shows "Ophører d. {currentPeriodEnd}" + an undo. Only
          // meaningful for source='purchase' rows; harmless false/null otherwise.
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

  const source = !enforceTierMap || !org
    ? 'legacy'
    : configById.size > 0 || orgById.size > 0
      ? 'db'
      : 'tier-map';
  return { modules, source };
};
