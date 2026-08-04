import { Project, Task } from '../../../types';
import { TaskAccessRole } from '../../tasks';

export type TaskDisplayMode = 'edit' | 'work' | 'view';

export interface TaskAccessRow {
  userId: string | null;
  role: TaskAccessRole;
  status: string;
}

export interface ComputeTaskRoleParams {
  task: Pick<Task, 'projectId' | 'ownerId' | 'assignees'> | null | undefined;
  project?: Pick<Project, 'ownerId' | 'team'> | null;
  userId: string | null | undefined;
  /** Rows from modules/tasks' listTaskAccess(taskId) — an explicit grant always wins. */
  accessRows?: TaskAccessRow[];
}

/**
 * Pure mirror of the SQL get_effective_task_role() function
 * (supabase/migrations/20260710000002_task_access_project_task_rls.sql) —
 * used for optimistic client-side UI; the RLS-backed RPC of the same name
 * remains the actual authorization source of truth.
 *
 * Precedence:
 *  1. An explicit quick_task_access row for (task, user) wins outright.
 *  2. Project task: project OWNER -> owner; project MANAGER -> responsible;
 *     an assignee -> worker; any other project member -> viewer.
 *  3. Quick task: tasks.ownerId -> owner; assignee -> worker.
 *  4. No access -> null.
 */
export const computeTaskRole = ({ task, project, userId, accessRows }: ComputeTaskRoleParams): TaskAccessRole | null => {
  if (!task || !userId) return null;

  const explicit = accessRows?.find(row => row.userId === userId && (row.status === 'pending' || row.status === 'active'));
  if (explicit) return explicit.role;

  const isAssignee = (task.assignees ?? []).some(a => a.id === userId);

  if (task.projectId) {
    if (project?.ownerId === userId) return 'owner';
    const member = project?.team?.find(m => m.id === userId);
    if (member?.role === 'MANAGER') return 'responsible';
    if (isAssignee) return 'worker';
    if (member) return 'viewer';
    return null;
  }

  if (task.ownerId === userId) return 'owner';
  if (isAssignee) return 'worker';
  return null;
};

/** The most-editable mode a role is allowed to reach — gates the "Rediger Opgave" toggle. */
export const maxModeForRole = (role: TaskAccessRole | null): TaskDisplayMode => {
  if (role === 'owner' || role === 'responsible') return 'edit';
  if (role === 'worker') return 'work';
  return 'view';
};

/**
 * Default landing mode for opening a task, per the confirmed product
 * decision: everyone — including Owner/Responsible — lands on the same
 * read/content-focused view; Owner/Responsible additionally get a
 * "Rediger Opgave" toggle to switch into the full edit form. A brand-new
 * task (no id yet) always opens directly in edit.
 */
export const initialDisplayModeFor = (task: Pick<Task, 'id'> | null | undefined, role: TaskAccessRole | null): TaskDisplayMode => {
  if (!task?.id) return 'edit';
  const max = maxModeForRole(role);
  return max === 'edit' ? 'work' : max;
};
