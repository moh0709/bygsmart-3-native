// Project-tab access branches — the role/visibility precedence, harvested verbatim from
// legacy/core/shell/projectTabAccess.ts.
//
// The branch ORDER is load-bearing:
//   CLIENT → OWNER/MANAGER → visibility all/some/standard/none → EXTERNAL-or-partner → fallback.
// Subtlety preserved: an EXTERNAL user WITH an explicit visibility resolves through the
// visibility branch, not 'external'.

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
