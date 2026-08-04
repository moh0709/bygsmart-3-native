const idsFromAssignees = (assignees) => Array.isArray(assignees)
  ? assignees.map((entry) => entry?.id).filter((id) => typeof id === 'string')
  : [];

const idsFromTeam = (team) => Array.isArray(team)
  ? team.map((entry) => entry?.id ?? entry?.user_id).filter((id) => typeof id === 'string')
  : [];

const taskTeamIds = (task, explicitTaskUserIds = []) => new Set([
  task?.owner_id,
  ...idsFromAssignees(task?.assignees),
  ...explicitTaskUserIds,
].filter((id) => typeof id === 'string'));

const projectMemberIds = (project, projectResourceUserIds = []) => new Set([
  project?.owner_id,
  ...idsFromTeam(project?.team),
  ...projectResourceUserIds,
].filter((id) => typeof id === 'string'));

export const canSendTaskChatNotification = ({
  userId,
  task,
  project,
  projectResourceUserIds = [],
  explicitTaskUserIds = [],
}) => {
  if (!userId || !task) return false;
  if (!task.project_id) return taskTeamIds(task, explicitTaskUserIds).has(userId);
  if (!project || project.id !== task.project_id) return false;
  return project.owner_id === userId
    || idsFromTeam(project.team).includes(userId)
    || projectResourceUserIds.includes(userId)
    || taskTeamIds(task, explicitTaskUserIds).has(userId);
};

export const filterTaskMentionRecipients = ({
  senderId,
  mentionedUserIds,
  task,
  project,
  projectResourceUserIds = [],
  explicitTaskUserIds = [],
}) => {
  const allowed = new Set([
    ...taskTeamIds(task, explicitTaskUserIds),
    ...projectMemberIds(project, projectResourceUserIds),
  ]);
  const unique = new Set();
  for (const id of Array.isArray(mentionedUserIds) ? mentionedUserIds : []) {
    if (typeof id === 'string' && id !== senderId && allowed.has(id)) unique.add(id);
  }
  return [...unique];
};
