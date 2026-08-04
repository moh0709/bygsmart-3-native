import React from 'react';
import { useTaskChatUnread } from '../hooks/useTaskChatUnread';

/**
 * Unread-count pill for a task's chat, rendered on TaskFormModal's chat tab
 * (modules/tasks). Lives here — with the chat it counts — so tasks can load it
 * lazily instead of statically importing field (field requires:['tasks']).
 */
export const TaskChatUnreadBadge: React.FC<{
  taskId: string;
  userId: string;
  isChatActive: boolean;
}> = ({ taskId, userId, isChatActive }) => {
  const unread = useTaskChatUnread(taskId, userId, isChatActive);
  if (unread <= 0) return null;
  return (
    <span
      className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white"
      aria-label={`${unread} ulæste beskeder`}
    >
      {unread > 99 ? '99+' : unread}
    </span>
  );
};
