// @bygsmart/core — offline authorisation (P2 2.7, AUDIT §7.5). Pure.
//
// The client caches its entitlements so it can gate UI offline, but that cache is
// only trusted for a bounded window. Authorisation is NEVER finally decided on the
// client: when a mutation queued offline replays, the SERVER re-adjudicates it
// against CURRENT entitlements — a module revoked while the device was offline must
// not let stale queued writes land. This module is the pure rule both sides use.

import type { ModuleId } from '../registry/types';

/** How long an offline entitlement cache is trusted before a refresh is required. */
export const ENTITLEMENT_CACHE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

export function isEntitlementCacheValid(cachedAt: number, now: number): boolean {
  return now - cachedAt < ENTITLEMENT_CACHE_TTL_MS;
}

/** Foundation modules are always entitled — never revocable, never gated. */
export const FOUNDATION_MODULES: ReadonlySet<ModuleId> = new Set<ModuleId>(['projects', 'tasks', 'tools', 'knowledge']);

/**
 * Which module a syncable entity belongs to. Identity/project/task entities are
 * foundation (unmapped ⇒ always allowed); the rest map to a gateable feature module.
 */
export const ENTITY_MODULE: Partial<Record<string, ModuleId>> = {
  // field
  task_check_ins: 'field',
  task_documentation: 'field',
  task_handovers: 'field',
  task_chat_messages: 'field',
  task_chat_reads: 'field',
  // quality
  task_quality_controls: 'quality',
  punch_list_layouts: 'quality',
  punch_list_items: 'quality',
  // purchasing / quotations / time / documents / planning
  purchases: 'purchasing',
  quotations: 'quotations',
  quotation_line_items: 'quotations',
  time_entries: 'time',
  time_registrations: 'time',
  org_time_responsibles: 'time',
  task_budget_rates: 'budget',
  documents: 'documents',
  document_visibility: 'documents',
  reminders: 'planning',
};

export interface ReplayVerdict {
  allowed: boolean;
  reason?: string;
}

/**
 * Adjudicate a replayed mutation against the caller's CURRENT enabled modules.
 * Foundation + unmapped entities always pass; a feature entity passes only while its
 * module is entitled. Fail-open: if `enabledModules` is null (entitlement data
 * unavailable) nothing is blocked — an outage must never hide paid features or,
 * here, reject legitimate writes.
 */
export function adjudicateReplay(entity: string, enabledModules: ReadonlySet<ModuleId> | null): ReplayVerdict {
  const mod = ENTITY_MODULE[entity];
  if (!mod || FOUNDATION_MODULES.has(mod)) return { allowed: true };
  if (!enabledModules) return { allowed: true }; // fail-open
  return enabledModules.has(mod)
    ? { allowed: true }
    : { allowed: false, reason: `module ${mod} not entitled` };
}
