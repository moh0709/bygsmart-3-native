// Server-side syncable-entity registry — the pull/mutation allow-list. Mirrors
// supabase/baseline/SYNCABLE_TABLES.md. Only the 23 id-PK "full" entities are
// served by the generic (updated_at, id) cursor endpoint; the 5 composite/derived
// ones (org_module_entitlements, task_chat_reads, org_time_responsibles,
// document_visibility, task_budget_rates) have no single `id` and are handled by
// dedicated paths (parent-derived tombstones / per-user cursors) — later pass.

export type Treatment = 'full' | 'derived-tombstone' | 'read-cache' | 'local-cursor';

export interface SyncEntity {
  table: string;
  treatment: Treatment;
  /** Has an `id` uuid PK → served by the generic (updated_at, id) cursor endpoint. */
  idPk: boolean;
  /** Emits its own tombstone (id-PK "full" tables). */
  ownTombstone: boolean;
}

const E = (table: string, treatment: Treatment, idPk: boolean, ownTombstone: boolean): SyncEntity => ({
  table,
  treatment,
  idPk,
  ownTombstone,
});

export const SYNC_ENTITIES: Record<string, SyncEntity> = {
  // ── identity ──
  profiles: E('profiles', 'full', true, true),
  organizations: E('organizations', 'full', true, true),
  organization_members: E('organization_members', 'full', true, true),
  org_module_entitlements: E('org_module_entitlements', 'read-cache', false, false),
  // ── project graph ──
  projects: E('projects', 'full', true, true),
  project_resources: E('project_resources', 'full', true, true),
  resource_task_access: E('resource_task_access', 'full', true, true),
  tasks: E('tasks', 'full', true, true),
  quick_task_access: E('quick_task_access', 'full', true, true),
  // ── field ──
  task_check_ins: E('task_check_ins', 'full', true, true),
  task_documentation: E('task_documentation', 'full', true, true),
  task_handovers: E('task_handovers', 'full', true, true),
  task_quality_controls: E('task_quality_controls', 'full', true, true),
  task_chat_messages: E('task_chat_messages', 'full', true, true),
  task_chat_reads: E('task_chat_reads', 'local-cursor', false, false),
  punch_list_layouts: E('punch_list_layouts', 'full', true, true),
  punch_list_items: E('punch_list_items', 'full', true, true),
  purchases: E('purchases', 'full', true, true),
  reminders: E('reminders', 'full', true, true),
  activity_log: E('activity_log', 'full', true, true),
  // ── time ──
  time_entries: E('time_entries', 'full', true, true),
  time_registrations: E('time_registrations', 'full', true, true),
  org_time_responsibles: E('org_time_responsibles', 'derived-tombstone', false, false),
  // ── documents ──
  documents: E('documents', 'full', true, true),
  document_visibility: E('document_visibility', 'derived-tombstone', false, false),
  // ── money (syncable-read) ──
  quotations: E('quotations', 'full', true, true),
  quotation_line_items: E('quotation_line_items', 'full', true, true),
  task_budget_rates: E('task_budget_rates', 'derived-tombstone', false, false),
};

/** Total syncable entities (matches the 28 in SYNCABLE_TABLES.md). */
export const SYNC_ENTITY_COUNT = Object.keys(SYNC_ENTITIES).length;

/** Entities the generic GET /api/sync/:entity cursor endpoint serves (id-PK). */
export function cursorEntity(name: string): SyncEntity | null {
  const e = SYNC_ENTITIES[name];
  return e && e.idPk ? e : null;
}
