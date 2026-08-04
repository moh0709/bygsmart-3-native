// ─────────────────────────────────────────────────────────────────────────────
// Project-tab access branches — the role/visibility precedence extracted
// verbatim from ProjectDetailPage's original `allowedTabs` memo (Phase 5).
//
// The branch ORDER is load-bearing and mirrors the old if-chain exactly:
//   CLIENT → OWNER/MANAGER → visibility all/some/standard/none →
//   EXTERNAL-or-partner-resource → fallback (standard-equivalent).
// Note the subtlety the old code had too: an EXTERNAL user WITH an explicit
// visibility setting resolves through the visibility branch, not 'external'.
//
// Module manifests declare each tab's branch membership via allowedIn(...) —
// keeping the precedence logic in ONE place instead of twelve predicates.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectTabContext } from '../registry/types';

export type ProjectTabBranch =
  | 'client'
  | 'owner-manager'
  | 'vis-all'
  | 'vis-some'
  | 'vis-standard'
  | 'vis-none'
  | 'external'
  | 'fallback';

export const resolveProjectTabBranch = (ctx: ProjectTabContext): ProjectTabBranch => {
  if (ctx.userRole === 'CLIENT') return 'client';
  if (ctx.userRole === 'OWNER' || ctx.userRole === 'MANAGER') return 'owner-manager';
  if (ctx.visibility === 'all') return 'vis-all';
  if (ctx.visibility === 'some') return 'vis-some';
  if (ctx.visibility === 'standard') return 'vis-standard';
  if (ctx.visibility === 'none') return 'vis-none';
  if (ctx.userRole === 'EXTERNAL' || ctx.isPartnerResource) return 'external';
  return 'fallback';
};

/** Predicate factory: tab allowed exactly in the listed branches. */
export const allowedIn = (...branches: ProjectTabBranch[]) => {
  const set = new Set(branches);
  return (ctx: ProjectTabContext): boolean => set.has(resolveProjectTabBranch(ctx));
};
