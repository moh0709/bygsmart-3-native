// @bygsmart/core — organization domain types + active-org selection (pure).
//
// Types harvested from legacy/services/organizations.ts; the active-org rule is
// lifted from legacy/core/org/OrgProvider.tsx (doFetch validation + activeOrg memo).
// The Supabase list/switch/invite calls stay in the app service — this module owns
// the shape and the selection rule, so the fallback logic is testable everywhere.
//
// Authorization never trusts the active org: RLS evaluates each row's org_id against
// membership. This picks which org the UI is *scoped* to, nothing more.

export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgMemberStatus = 'pending' | 'active' | 'removed';

export interface Organization {
  id: string;
  name: string;
  cvr: string | null;
  logoUrl: string | null;
  grandfathered: boolean;
  storageAllowanceGb: number;
  /** Non-null ⇒ team-backed org: members are managed via Teams & seats. */
  sourceTeamId: string | null;
  createdBy: string;
}

export interface OrgMembership {
  role: OrgRole;
  status: OrgMemberStatus;
  org: Organization;
}

export interface OrgStorageUsage {
  bytesTotal: number;
  bytesLegacy: number;
  objectCount: number;
  computedAt: string;
}

/**
 * Resolve which org id the UI should scope to.
 * Keeps `requestedId` (e.g. profiles.active_org_id) only if it maps to an ACTIVE
 * membership; otherwise falls back to the first active membership, else null.
 */
export const resolveActiveOrgId = (
  memberships: OrgMembership[],
  requestedId: string | null,
): string | null => {
  const requestedIsValid = memberships.some(
    (m) => m.org.id === requestedId && m.status === 'active',
  );
  if (requestedIsValid) return requestedId;
  return memberships.find((m) => m.status === 'active')?.org.id ?? null;
};

/**
 * The resolved active org itself (never a pending membership's org). Null when the
 * caller has no active membership.
 */
export const selectActiveOrg = (
  memberships: OrgMembership[],
  requestedId: string | null,
): Organization | null => {
  const resolvedId = resolveActiveOrgId(memberships, requestedId);
  return memberships.find((m) => m.org.id === resolvedId && m.status === 'active')?.org ?? null;
};
