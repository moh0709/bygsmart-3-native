import { describe, it, expect } from 'vitest';
import type { SubscriptionTier } from '../types';
import {
  SUBSCRIPTION_PLANS,
  TIER_PRIORITY,
  maxSubscriptionTier,
  PRO_TOOLS_IDS,
  PLAN_LABELS,
  getPlanName,
} from './subscriptionPlans';

describe('SUBSCRIPTION_PLANS', () => {
  it('FREE plan allows max 1 project and cannot invite team', () => {
    expect(SUBSCRIPTION_PLANS.FREE.maxActiveProjects).toBe(1);
    expect(SUBSCRIPTION_PLANS.FREE.canInviteTeam).toBe(false);
    expect(SUBSCRIPTION_PLANS.FREE.allowedRoles).toEqual([]);
  });

  it('PREMIUM has effectively unlimited projects', () => {
    expect(SUBSCRIPTION_PLANS.PREMIUM.maxActiveProjects).toBeGreaterThan(100);
  });

  it('limits are monotonically non-decreasing up the tiers', () => {
    for (let i = 1; i < TIER_PRIORITY.length; i++) {
      const prev = TIER_PRIORITY[i - 1];
      const cur = TIER_PRIORITY[i];
      if (!prev || !cur) continue;
      const lo = SUBSCRIPTION_PLANS[prev];
      const hi = SUBSCRIPTION_PLANS[cur];
      expect(hi.maxActiveProjects).toBeGreaterThanOrEqual(lo.maxActiveProjects);
      expect(hi.aiDailyLimit).toBeGreaterThanOrEqual(lo.aiDailyLimit);
      expect(hi.allowedRoles.length).toBeGreaterThanOrEqual(lo.allowedRoles.length);
    }
  });

  it('financial tools + advanced calculators unlock at PRO', () => {
    expect(SUBSCRIPTION_PLANS.FREE.financialTools).toBe(false);
    expect(SUBSCRIPTION_PLANS.FREE.advancedCalculators).toBe(false);
    expect(SUBSCRIPTION_PLANS.PRO.financialTools).toBe(true);
    expect(SUBSCRIPTION_PLANS.PRO.advancedCalculators).toBe(true);
  });
});

describe('maxSubscriptionTier', () => {
  it('returns the higher of two tiers (trial overlay)', () => {
    expect(maxSubscriptionTier('FREE', 'PRO')).toBe('PRO');
    expect(maxSubscriptionTier('PREMIUM', 'PRO')).toBe('PREMIUM');
    expect(maxSubscriptionTier('ENTERPRISE', 'FREE')).toBe('ENTERPRISE');
  });

  it('is commutative and idempotent', () => {
    const tiers: SubscriptionTier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];
    for (const a of tiers) {
      expect(maxSubscriptionTier(a, a)).toBe(a);
      for (const b of tiers) {
        expect(maxSubscriptionTier(a, b)).toBe(maxSubscriptionTier(b, a));
      }
    }
  });
});

describe('PRO_TOOLS_IDS', () => {
  it('contains no duplicate ids', () => {
    expect(new Set(PRO_TOOLS_IDS).size).toBe(PRO_TOOLS_IDS.length);
  });
});

describe('getPlanName', () => {
  it('maps every tier to its Danish label', () => {
    expect(getPlanName('FREE')).toBe('Start');
    expect(getPlanName('PRO')).toBe('Mester');
    expect(getPlanName('PREMIUM')).toBe('Entreprise');
    expect(getPlanName('ENTERPRISE')).toBe('Koncern');
  });

  it('covers exactly the four tiers', () => {
    expect(Object.keys(PLAN_LABELS).sort()).toEqual(
      ['ENTERPRISE', 'FREE', 'PREMIUM', 'PRO'].sort(),
    );
  });
});
