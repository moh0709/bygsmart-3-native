// Pure authorization check for server/routes/taskInviteRoutes.js — mirrors
// get_effective_task_role()'s owner/responsible precedence (supabase/migrations/
// 20260710000002_task_access_project_task_rls.sql) against data already
// fetched via the trusted admin client, since a service-role call has no
// auth.uid() context to invoke that RPC directly.
export const canGrantTaskInvite = ({ userId, task, project, explicitGrantRole }) => {
  if (!userId || !task) return false;
  if (task.owner_id === userId) return true;
  if (project?.owner_id === userId) return true;
  if (project?.team?.some((m) => m.id === userId && m.role === 'MANAGER')) return true;
  return explicitGrantRole === 'owner' || explicitGrantRole === 'responsible';
};
