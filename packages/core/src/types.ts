// @bygsmart/core — shared domain types (seed).
// Harvested from legacy/types.ts (808 LOC). This is the minimal set the registry +
// access rules need; the rest is harvested incrementally. `services/database.types.ts`
// (generated Supabase schema) stays infra — domain types map onto it, they don't mirror it.

/** Application role of a user within a project/org (legacy types.ts:3). */
export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'EXTERNAL' | 'CLIENT';

/**
 * Billing tier (legacy types.ts:6). Structurally identical to the entitlements
 * engine's `Tier` (entitlements/moduleCatalog.ts) — this is the domain-facing
 * name; the two are mutually assignable.
 */
export type SubscriptionTier = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';

/** Per-project-member resource visibility (legacy types.ts:507). */
export type ResourceVisibility = 'all' | 'some' | 'standard' | 'none';

/** Effective role on a specific task (mirror of SQL get_effective_task_role). */
export type TaskAccessRole = 'owner' | 'responsible' | 'worker' | 'viewer';

/** Task workflow status (legacy types.ts:117). */
export type TaskStatus = 'Igangværende' | 'Udført' | 'To Do' | 'Forfalden' | 'Annulleret';

/** Handover chain state on a task (legacy types.ts:151). */
export type TaskHandoverStatus = 'none' | 'submitted' | 'accepted' | 'rejected';

/** Project lifecycle status (legacy projectLifecycle.ts writes these literals). */
export type ProjectStatus = 'I gang' | 'Afsluttet' | 'ARCHIVED' | 'CANCELLED';

/** Partner invitation status (legacy types.ts:531). */
export type PartnerInviteStatus =
  | 'invited'
  | 'negotiating'
  | 'accepted'
  | 'declined'
  | 'cancelled';

/**
 * Framework-agnostic status pill tone. Kept structurally identical to the UI
 * kit's `BadgeTone` (@bygsmart/ui Badge) so status metadata can flow straight
 * into `<Badge tone={…}>` without core depending on the UI layer.
 */
export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'pending';

export interface TeamMember {
  id: string;
  role: UserRole;
}

export interface TaskAssignee {
  id: string;
  name?: string;
  initials?: string;
}

export interface Task {
  id?: string;
  projectId?: string | null;
  ownerId?: string | null;
  assignees?: TaskAssignee[];
  status?: TaskStatus;
  handoverStatus?: TaskHandoverStatus;
}

export interface Project {
  ownerId?: string | null;
  team?: TeamMember[];
}
