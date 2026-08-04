// @bygsmart/core — subscription tiers → plan limits (harvested from legacy/config/subscriptionPlans.ts).
//
// PURE tier→capability data + the trial-overlay helper. The DOM-flavoured
// presentation blob from 2.1 (Tailwind colour classes, prices, feature bullets)
// is deliberately NOT harvested here — that is marketplace/presentation copy and
// lands with the marketplace catalog later. Only the machine-readable limits,
// tier ordering, Pro-tool id list, and plan display labels come across.

import type { SubscriptionTier, UserRole } from '../types';

export interface PlanLimits {
  maxActiveProjects: number;
  canInviteTeam: boolean;
  /** Which roles this tier may invite. */
  allowedRoles: UserRole[];
  aiDailyLimit: number;
  /** Static ("Pro") calculators. */
  advancedCalculators: boolean;
  /** Budget / purchasing. */
  financialTools: boolean;
}

/** Low → high tier ordering (index = priority). */
export const TIER_PRIORITY: SubscriptionTier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

/** Higher of two tiers — used to overlay an admin-granted trial on the real tier. */
export const maxSubscriptionTier = (a: SubscriptionTier, b: SubscriptionTier): SubscriptionTier => {
  const ai = TIER_PRIORITY.indexOf(a);
  const bi = TIER_PRIORITY.indexOf(b);
  return TIER_PRIORITY[Math.max(ai, bi)] ?? a;
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanLimits> = {
  FREE: {
    maxActiveProjects: 1,
    canInviteTeam: false,
    allowedRoles: [],
    aiDailyLimit: 5,
    advancedCalculators: false,
    financialTools: false,
  },
  PRO: {
    maxActiveProjects: 5,
    canInviteTeam: true,
    allowedRoles: ['EMPLOYEE', 'CLIENT'], // Staff + Clients
    aiDailyLimit: 50,
    advancedCalculators: true,
    financialTools: true,
  },
  PREMIUM: {
    maxActiveProjects: 1000, // effectively unlimited
    canInviteTeam: true,
    allowedRoles: ['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'], // full RBAC incl. subcontractors
    aiDailyLimit: 1000,
    advancedCalculators: true,
    financialTools: true,
  },
  ENTERPRISE: {
    maxActiveProjects: 10000,
    canInviteTeam: true,
    allowedRoles: ['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'],
    aiDailyLimit: 10000,
    advancedCalculators: true,
    financialTools: true,
  },
};

/** Canonical calculator ids that require Pro/Premium (from listCalculators()). */
export const PRO_TOOLS_IDS: readonly string[] = [
  // Areal & Rumfang (cat 1)
  'rumareal',
  'vaegareal',
  'rumfangsberegner',
  // Gulve & Overflader (cat 2)
  'flisemaengde',
  'gulvisolering',
  'traegulv-maengde',
  'taeppe-laminat',
  'gulvafretning',
  // Vægge & Skillevægge (cat 3)
  'maling-grunder',
  'gipsplader',
  'puds-spartel',
  'vaegisolering',
  'mursten-blokke',
  'vaegge-skillevaegge-skeletvaeg',
  'vaegge-skillevaegge-maling-pro',
  // Lofter & Tag (cat 4)
  'loftisolering',
  'lofter-tag-laegter',
  'lofter-tag-spaer-estimat',
  'lofter-tag-loftplader',
  // Beton & Armering (cat 5)
  'beton-volumen',
  'blandingsforhold',
  'beton-armering-fundablokke',
  'beton-armering-armeringsstaal',
  'beton-armering-forskalling',
  // Udgravning & Jord (cat 6)
  'udgravning-jord-jordvolumen',
  'udgravning-jord-skraaning',
  'udgravning-jord-tilbagefyldning',
  // Udenomsarealer (cat 7)
  'udenomsarealer-fald',
  'udenomsarealer-hegn',
  'flisebelaegning',
  // Geometri (cat 8)
  'geometri-pythagoras',
  'geometri-cirkel',
  // Døre & Vinduer (cat 9)
  'doere-vinduer-redningsaabning',
  'doere-vinduer-vinduesareal',
  // Statiske Beregninger (Phase 2 Pro)
  'statiske-beregninger-bjaelkebelastning',
  'statiske-beregninger-soejlebelastning',
  // Energi & Klima (Phase 2 Pro)
  'energi-klima-varmetab',
  'energi-klima-co2',
];

/** Danish display name per tier (Start / Mester / Entreprise / Koncern). */
export const PLAN_LABELS: Record<SubscriptionTier, string> = {
  FREE: 'Start',
  PRO: 'Mester',
  PREMIUM: 'Entreprise',
  ENTERPRISE: 'Koncern',
};

export const getPlanName = (tier: SubscriptionTier): string => PLAN_LABELS[tier] ?? tier;
