// ─────────────────────────────────────────────────────────────────────────────
// modules/field — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// Formerly services/taskWorkspace.ts. The task-workspace service API is
// re-exported verbatim plus the workspace components that host surfaces
// (modules/tasks' GlobalTasksPage + TaskFormModal, quick-task flows) render —
// always via dynamic import from tasks, since field requires:['tasks'].
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/taskWorkspace';
export { TaskWorkspaceContent } from './components/TaskWorkspaceContent';
export { TaskWorkspaceModal } from './components/TaskWorkspaceModal';
export { InviteTaskMemberModal } from './components/InviteTaskMemberModal';
export { default as TaskChatTab } from './components/TaskChatTab';
export { default as TaskDocumentationTab } from './components/TaskDocumentationTab';
export { useTaskChatUnread } from './hooks/useTaskChatUnread';
export { TaskChatUnreadBadge } from './components/TaskChatUnreadBadge';
