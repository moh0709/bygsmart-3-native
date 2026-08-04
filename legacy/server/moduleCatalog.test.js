import { describe, it, expect } from 'vitest';
import {
  MODULE_IDS,
  DEFAULT_MIN_TIER,
  tierIncludes,
  resolveModuleEntitlements,
} from './moduleCatalog.js';

const LEAN_ORG = { grandfathered: false };
const GRANDFATHERED_ORG = { grandfathered: true };
const NOW = new Date('2026-07-14T12:00:00Z').getTime();
const FUTURE = '2026-08-01T00:00:00Z';
const PAST = '2026-06-01T00:00:00Z';

describe('moduleCatalog', () => {
  it('has exactly the 19 canonical module ids, each with a default tier', () => {
    expect(MODULE_IDS).toHaveLength(19);
    expect(new Set(MODULE_IDS).size).toBe(19);
    for (const id of MODULE_IDS) {
      expect(DEFAULT_MIN_TIER[id], `missing DEFAULT_MIN_TIER for ${id}`).toBeTruthy();
    }
  });

  describe('tierIncludes', () => {
    it('orders tiers FREE < PRO < PREMIUM < ENTERPRISE', () => {
      expect(tierIncludes('FREE', 'FREE')).toBe(true);
      expect(tierIncludes('FREE', 'PRO')).toBe(false);
      expect(tierIncludes('PRO', 'PRO')).toBe(true);
      expect(tierIncludes('PRO', 'PREMIUM')).toBe(false);
      expect(tierIncludes('PREMIUM', 'PRO')).toBe(true);
      expect(tierIncludes('ENTERPRISE', 'ENTERPRISE')).toBe(true);
    });

    it('fails open on unknown values', () => {
      expect(tierIncludes('BOGUS', 'PRO')).toBe(true);
      expect(tierIncludes('PRO', 'BOGUS')).toBe(true);
      expect(tierIncludes('PRO', null)).toBe(true);
    });
  });

  describe('resolveModuleEntitlements', () => {
    it('enforcement off → every module on, source legacy (emergency override)', () => {
      const { modules, source } = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: false,
        org: LEAN_ORG,
      });
      expect(source).toBe('legacy');
      for (const id of MODULE_IDS) {
        expect(modules[id]).toEqual({ enabled: true, source: 'legacy', validUntil: null });
      }
    });

    it('no org context → fail-open legacy, even with enforcement on', () => {
      const { modules, source } = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: true,
        org: null,
      });
      expect(source).toBe('legacy');
      expect(modules.budget.enabled).toBe(true);
    });

    it('admin kill-switch wins over everything, including grandfathering', () => {
      const { modules } = resolveModuleEntitlements({
        tier: 'ENTERPRISE',
        configRows: [{ module_id: 'budget', enabled: false, min_tier: null }],
        enforceTierMap: true,
        org: GRANDFATHERED_ORG,
      });
      expect(modules.budget).toEqual({ enabled: false, source: 'admin', validUntil: null });
      expect(modules.projects.enabled).toBe(true);
      expect(modules.projects.source).toBe('grandfathered');
    });

    it('grandfathered org → everything on regardless of tier', () => {
      const { modules } = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: true,
        org: GRANDFATHERED_ORG,
      });
      for (const id of MODULE_IDS) {
        expect(modules[id], `${id} should be grandfathered on`).toEqual({
          enabled: true, source: 'grandfathered', validUntil: null,
        });
      }
    });

    it('lean org → tier map gates by DEFAULT_MIN_TIER', () => {
      const free = resolveModuleEntitlements({ tier: 'FREE', configRows: [], enforceTierMap: true, org: LEAN_ORG });
      expect(free.source).toBe('tier-map');
      expect(free.modules.projects.enabled).toBe(true);
      expect(free.modules.tools.enabled).toBe(true);
      expect(free.modules.time.enabled).toBe(false);
      expect(free.modules.budget.enabled).toBe(false);
      expect(free.modules.integrations.enabled).toBe(false);

      const pro = resolveModuleEntitlements({ tier: 'PRO', configRows: [], enforceTierMap: true, org: LEAN_ORG });
      expect(pro.modules.time.enabled).toBe(true);
      expect(pro.modules.field.enabled).toBe(true);
      expect(pro.modules.budget.enabled).toBe(false);

      const premium = resolveModuleEntitlements({ tier: 'PREMIUM', configRows: [], enforceTierMap: true, org: LEAN_ORG });
      expect(premium.modules.budget.enabled).toBe(true);
      expect(premium.modules.ai.enabled).toBe(true);
      expect(premium.modules['client-portal'].enabled).toBe(false);

      const enterprise = resolveModuleEntitlements({ tier: 'ENTERPRISE', configRows: [], enforceTierMap: true, org: LEAN_ORG });
      for (const id of MODULE_IDS) {
        expect(enterprise.modules[id].enabled, `${id} should be on for ENTERPRISE`).toBe(true);
      }
    });

    it('org override: disabled beats the tier map', () => {
      const { modules } = resolveModuleEntitlements({
        tier: 'ENTERPRISE',
        configRows: [],
        enforceTierMap: true,
        org: LEAN_ORG,
        orgRows: [{ module_id: 'ai', status: 'disabled', source: 'admin', valid_until: null }],
      });
      expect(modules.ai).toEqual({ enabled: false, source: 'admin', validUntil: null });
    });

    it('org override: enabled/purchase grants a module the tier lacks', () => {
      const { modules, source } = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: true,
        org: LEAN_ORG,
        orgRows: [{ module_id: 'time', status: 'enabled', source: 'purchase', valid_until: null }],
      });
      expect(source).toBe('db');
      expect(modules.time).toEqual({
        enabled: true,
        source: 'purchase',
        validUntil: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      });
      expect(modules.budget.enabled).toBe(false);
    });

    it('org trial: valid until the date, then falls back to the tier map', () => {
      const active = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: true,
        org: LEAN_ORG,
        orgRows: [{ module_id: 'budget', status: 'trial', source: 'trial', valid_until: FUTURE }],
        now: NOW,
      });
      expect(active.modules.budget).toEqual({
        enabled: true,
        source: 'trial',
        validUntil: FUTURE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      });

      const expired = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [],
        enforceTierMap: true,
        org: LEAN_ORG,
        orgRows: [{ module_id: 'budget', status: 'trial', source: 'trial', valid_until: PAST }],
        now: NOW,
      });
      expect(expired.modules.budget.enabled).toBe(false);
      expect(expired.modules.budget.source).toBe('tier');
    });

    it('a global config row min_tier overrides the catalog default', () => {
      const { modules } = resolveModuleEntitlements({
        tier: 'FREE',
        configRows: [{ module_id: 'time', enabled: true, min_tier: 'FREE' }],
        enforceTierMap: true,
        org: LEAN_ORG,
      });
      expect(modules.time.enabled).toBe(true);
      expect(modules.time.source).toBe('tier');
      expect(modules.budget.enabled).toBe(false);
    });
  });
});
