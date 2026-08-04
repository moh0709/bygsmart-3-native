import { useEffect, useState } from 'react';
import {
  getTaskChatUnreadCount,
  markTaskChatRead,
  subscribeToTaskChat,
  subscribeToTaskChatReads,
} from '../services/taskChat';

export const useTaskChatUnread = (
  taskId: string | undefined,
  currentUserId: string | undefined,
  isChatActive: boolean
) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!taskId || !currentUserId) return;
    let active = true;
    const refresh = () => getTaskChatUnreadCount(taskId, currentUserId)
      .then((count) => { if (active) setUnreadCount(isChatActive ? 0 : count); })
      .catch(() => undefined);
    void refresh();

    const unsubscribeMessages = subscribeToTaskChat(taskId, (message) => {
      if (message.senderId === currentUserId) return;
      if (isChatActive) {
        setUnreadCount(0);
        void markTaskChatRead(taskId, currentUserId).catch(() => undefined);
      } else {
        setUnreadCount((count) => count + 1);
      }
    });
    const unsubscribeReads = subscribeToTaskChatReads(taskId, currentUserId, refresh);
    return () => {
      active = false;
      unsubscribeMessages();
      unsubscribeReads();
    };
  }, [taskId, currentUserId, isChatActive]);

  useEffect(() => {
    if (!isChatActive || !taskId || !currentUserId) return;
    setUnreadCount(0);
    void markTaskChatRead(taskId, currentUserId).catch(() => undefined);
  }, [isChatActive, taskId, currentUserId]);

  return unreadCount;
};
