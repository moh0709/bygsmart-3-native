// Pure authorization check for server/routes/orgRoutes.js — mirrors
// get_org_role()'s owner/admin gate (supabase/migrations/
// 20260713000002_org_rls_helpers.sql) against a membership row already
// fetched via the trusted admin client, since a service-role call has no
// auth.uid() context to invoke that RPC directly.
export const canManageOrg = (membership) =>
  !!membership &&
  membership.status === 'active' &&
  (membership.role === 'owner' || membership.role === 'admin');
