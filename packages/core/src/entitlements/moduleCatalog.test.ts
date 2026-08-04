// TEST LAYER 2 — the entitlement engine's precedence. New tests written for the harvest.
import { describe, it, expect } from 'vitest';
import type { ModuleId } from '../registry/types';
import {
  resolveModuleEntitlements,
  tierIncludes,
  MODULE_PRICING,
  MODULE_NAMES,
  DEFAULT_MIN_TIER,
  type ResolveModuleEntitlementsInput,
} from './moduleCatalog';

describe('tierIncludes', () => {
  it('true when tier is at or above minTier', () => {
    expect(tierIncludes('PRO', 'FREE')).toBe(true);
    expect(tierIncludes('PRO', 'PRO')).toBe(true);
    expect(tierIncludes('ENTERPRISE', 'PREMIUM')).toBe(true);
  });
  it('false when below', () => {
    expect(tierIncludes('FREE', 'PRO')).toBe(false);
  });
  it('fails open for null minTier or unknown tiers', () => {
    expect(tierIncludes('FREE', null)).toBe(true);
    expect(tierIncludes('WAT', 'PRO')).toBe(true);
  });
});

const base: ResolveModuleEntitlementsInput = {
  tier: 'FREE',
  configRows: [],
  enforceTierMap: true,
  org: { grandfathered: false },
  orgRows: [],
  now: 1000,
};

describe('resolveModuleEntitlements — precedence order', () => {
  it('kill-switch: config enabled=false → OFF admin, beats even grandfathered', () => {
    const { modules } = resolveModuleEntitlements({
      ...base,
      org: { grandfathered: true },
      configRows: [{ module_id: 'field', enabled: false }],
    });
    expect(modules.field).toMatchObject({ enabled: false, source: 'admin' });
  });

  it('enforceTierMap=false → all ON legacy', () => {
    const { modules, source } = resolveModuleEntitlements({ ...base, enforceTierMap: false });
    expect(modules.budget).toMatchObject({ enabled: true, source: 'legacy' });
    expect(source).toBe('legacy');
  });

  it('no org → all ON legacy (fail-open)', () => {
    const { modules, source } = resolveModuleEntitlements({ ...base, org: null });
    expect(modules.ai).toMatchObject({ enabled: true, source: 'legacy' });
    expect(source).toBe('legacy');
  });

  it('grandfathered org → all ON grandfathered', () => {
    const { modules } = resolveModuleEntitlements({ ...base, org: { grandfathered: true } });
    expect(modules.integrations).toMatchObject({ enabled: true, source: 'grandfathered' });
  });

  it('org row disabled → OFF admin', () => {
    const { modules, source } = resolveModuleEntitlements({ ...base, orgRows: [{ module_id: 'field', status: 'disabled' }] });
    expect(modules.field).toMatchObject({ enabled: false, source: 'admin' });
    expect(source).toBe('db');
  });

  it('org row enabled (no expiry) → ON with its source', () => {
    const { modules } = resolveModuleEntitlements({ ...base, orgRows: [{ module_id: 'budget', status: 'enabled', source: 'purchase' }] });
    expect(modules.budget).toMatchObject({ enabled: true, source: 'purchase' });
  });

  it('trial with a future valid_until → ON trial, carrying cancel/period fields', () => {
    const { modules } = resolveModuleEntitlements({
      ...base,
      now: 1000,
      orgRows: [{ module_id: 'ai', status: 'trial', valid_until: new Date(5000).toISOString(), cancel_at_period_end: true, current_period_end: new Date(5000).toISOString() }],
    });
    expect(modules.ai).toMatchObject({ enabled: true, source: 'trial', cancelAtPeriodEnd: true });
  });

  it('an expired trial falls through to the tier map', () => {
    const { modules } = resolveModuleEntitlements({
      ...base,
      tier: 'FREE',
      now: 10000,
      orgRows: [{ module_id: 'ai', status: 'trial', valid_until: new Date(5000).toISOString() }],
    });
    // ai's default min_tier is PREMIUM; org tier FREE → off after expiry
    expect(modules.ai).toMatchObject({ enabled: false, source: 'tier' });
  });

  it('tier map: a FREE org gets FREE modules but not PRO', () => {
    const { modules, source } = resolveModuleEntitlements({ ...base, tier: 'FREE' });
    expect(modules.projects.enabled).toBe(true);
    expect(modules.field.enabled).toBe(false);
    expect(source).toBe('tier-map');
  });

  it('a config-row min_tier overrides the default tier gate', () => {
    const { modules } = resolveModuleEntitlements({ ...base, tier: 'PRO', configRows: [{ module_id: 'budget', min_tier: 'PRO' }] });
    expect(modules.budget.enabled).toBe(true); // PREMIUM default overridden to PRO
  });
});

describe('catalog data integrity (collapsed parity)', () => {
  it('MODULE_PRICING names match MODULE_NAMES', () => {
    for (const id of Object.keys(MODULE_PRICING) as ModuleId[]) {
      expect(MODULE_PRICING[id]?.name).toBe(MODULE_NAMES[id]);
    }
  });
  it('DEFAULT_MIN_TIER covers all 19 modules', () => {
    expect(Object.keys(DEFAULT_MIN_TIER)).toHaveLength(19);
  });
});
