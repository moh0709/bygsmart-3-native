import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_IDS, type ModuleId } from '@bygsmart/core';

/**
 * The caller's CURRENT enabled modules, for server-side replay adjudication (P2 2.7).
 * Fail-open: starts from every module and removes only those the caller's active org
 * has explicitly disabled or whose trial has lapsed. Returns null when the caller has
 * no active org (nothing to adjudicate against) — adjudicateReplay then allows all.
 */
export async function resolveEnabledModules(
  serviceDb: SupabaseClient,
  userId: string,
): Promise<Set<ModuleId> | null> {
  const { data: prof } = await serviceDb
    .from('profiles')
    .select('active_org_id')
    .eq('id', userId)
    .maybeSingle();
  const orgId = (prof as { active_org_id?: string } | null)?.active_org_id;
  if (!orgId) return null;

  const { data: rows } = await serviceDb
    .from('org_module_entitlements')
    .select('module_id, status, valid_until')
    .eq('org_id', orgId);

  const now = Date.now();
  const revoked = new Set<string>();
  for (const r of (rows ?? []) as { module_id: string; status: string; valid_until: string | null }[]) {
    if (r.status === 'disabled') revoked.add(r.module_id);
    else if (r.status === 'trial' && r.valid_until && Date.parse(r.valid_until) < now) revoked.add(r.module_id);
  }
  return new Set(MODULE_IDS.filter((id) => !revoked.has(id)));
}
