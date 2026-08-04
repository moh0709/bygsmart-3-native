// @bygsmart/core — shared domain types (seed).
// Harvested from legacy/types.ts (808 LOC). This is the minimal set the registry +
// access rules need; the rest is harvested incrementally. `services/database.types.ts`
// (generated Supabase schema) stays infra — domain types map onto it, they don't mirror it.

/** Application role of a user within a project/org (legacy types.ts:3). */
export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'EXTERNAL' | 'CLIENT';

/** Per-project-member resource visibility (legacy types.ts:507). */
export type ResourceVisibility = 'all' | 'some' | 'standard' | 'none';

/** Effective role on a specific task (mirror of SQL get_effective_task_role). */
export type TaskAccessRole = 'owner' | 'responsible' | 'worker' | 'viewer';

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
}

export interface Project {
  ownerId?: string | null;
  team?: TeamMember[];
}
