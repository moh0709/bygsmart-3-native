import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCount: vi.fn(),
  markRead: vi.fn(),
  subscribeMessages: vi.fn(),
  subscribeReads: vi.fn(),
}));

vi.mock('../services/taskChat', () => ({
  getTaskChatUnreadCount: mocks.getCount,
  markTaskChatRead: mocks.markRead,
  subscribeToTaskChat: mocks.subscribeMessages,
  subscribeToTaskChatReads: mocks.subscribeReads,
}));

import { useTaskChatUnread } from './useTaskChatUnread';

describe('useTaskChatUnread', () => {
  let onMessage: (message: { senderId: string }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCount.mockResolvedValue(2);
    mocks.markRead.mockResolvedValue(undefined);
    mocks.subscribeMessages.mockImplementation((_taskId, callback) => {
      onMessage = callback;
      return () => undefined;
    });
    mocks.subscribeReads.mockReturnValue(() => undefined);
  });

  test('counts only other users while inactive', async () => {
    const { result } = renderHook(() => useTaskChatUnread('task-1', 'user-1', false));
    await waitFor(() => expect(result.current).toBe(2));

    act(() => onMessage({ senderId: 'user-1' }));
    expect(result.current).toBe(2);
    act(() => onMessage({ senderId: 'user-2' }));
    expect(result.current).toBe(3);
  });

  test('clears only the active user cursor when chat opens', async () => {
    const { result } = renderHook(() => useTaskChatUnread('task-1', 'user-1', true));
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith('task-1', 'user-1'));
    expect(result.current).toBe(0);

    act(() => onMessage({ senderId: 'user-2' }));
    expect(result.current).toBe(0);
    expect(mocks.markRead).toHaveBeenLastCalledWith('task-1', 'user-1');
  });
});
