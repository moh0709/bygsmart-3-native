// ─────────────────────────────────────────────────────────────────────────────
// Pending signup plan — carries the plan a visitor picked on the marketing site
// (…/#/register?plan=mester) through the email-confirmation round-trip so the
// subscription chooser can open on the right plan after they log in.
//
// The landing CTAs use marketing names (mester / entreprise); the app uses tier
// keys. planParamToTier() bridges the two. Stored in localStorage; consumed once
// by SettingsPage (which clears it).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bygsmart_signup_plan';

// Accepts both the marketing names used on bygsmart.com and the raw tier keys.
const PARAM_TO_TIER: Record<string, string> = {
  mester: 'PRO',
  pro: 'PRO',
  entreprise: 'PREMIUM',
  premium: 'PREMIUM',
  koncern: 'ENTERPRISE',
  enterprise: 'ENTERPRISE',
};

const VALID_TIERS = new Set(['PRO', 'PREMIUM', 'ENTERPRISE']);

/** Map a ?plan= value (marketing name or tier key) to a canonical tier, or null. */
export const planParamToTier = (param?: string | null): string | null => {
  if (!param) return null;
  return PARAM_TO_TIER[param.trim().toLowerCase()] ?? null;
};

export const isPaidTierKey = (tier?: string | null): boolean =>
  !!tier && VALID_TIERS.has(tier);

export const setPendingPlan = (tier: string): void => {
  try {
    if (VALID_TIERS.has(tier)) localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    /* storage unavailable — non-fatal */
  }
};

export const getPendingPlan = (): string | null => {
  try {
    const tier = localStorage.getItem(STORAGE_KEY);
    return tier && VALID_TIERS.has(tier) ? tier : null;
  } catch {
    return null;
  }
};

export const clearPendingPlan = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
};
