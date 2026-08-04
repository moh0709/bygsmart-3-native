import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PLANS } from './subscriptionPlans';

describe('SUBSCRIPTION_PLANS', () => {
  it('FREE plan allows max 1 project', () => {
    expect(SUBSCRIPTION_PLANS.FREE.maxActiveProjects).toBe(1);
  });

  it('FREE plan cannot invite team', () => {
    expect(SUBSCRIPTION_PLANS.FREE.canInviteTeam).toBe(false);
  });

  it('PREMIUM has effectively unlimited projects', () => {
    expect(SUBSCRIPTION_PLANS.PREMIUM.maxActiveProjects).toBeGreaterThan(100);
  });

  it('PRO AI limit is higher than FREE', () => {
    expect(SUBSCRIPTION_PLANS.PRO.aiDailyLimit).toBeGreaterThan(
      SUBSCRIPTION_PLANS.FREE.aiDailyLimit
    );
  });
});