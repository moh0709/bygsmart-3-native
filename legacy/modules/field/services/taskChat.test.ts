import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  uploadTaskFile: vi.fn(),
}));

vi.mock('../../../services/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  },
}));

vi.mock('./taskWorkspace/storage', () => ({ uploadTaskFile: mocks.uploadTaskFile }));

import { listTaskChatMessages, sendTaskChatMessage } from './taskChat';

describe('taskChat service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  test('derives the inserted project from the referenced task', async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'message-1', task_id: 'task-1', project_id: 'actual-project',
            sender_id: 'user-1', sender_name: 'Ada', mentions: [], created_at: '2026-07-03T10:00:00Z',
          },
          error: null,
        }),
      })),
    }));

    mocks.from.mockImplementation((table: string) => {
      if (table === 'tasks') return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { project_id: 'actual-project' }, error: null }) })) })),
      };
      if (table === 'profiles') return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Ada' } }) })) })),
      };
      if (table === 'task_chat_messages') return { insert };
      throw new Error(`Unexpected table ${table}`);
    });

    await sendTaskChatMessage({ taskId: 'task-1', projectId: 'spoofed-project', body: 'Hej' });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      task_id: 'task-1',
      project_id: 'actual-project',
    }));
  });

  test('supports standalone tasks by inserting a null project id', async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'message-2', task_id: 'task-2', project_id: null,
            sender_id: 'user-1', sender_name: 'Ada', mentions: [], created_at: '2026-07-03T10:00:00Z',
          },
          error: null,
        }),
      })),
    }));
    mocks.from.mockImplementation((table: string) => {
      if (table === 'tasks') return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { project_id: null }, error: null }) })) })),
      };
      if (table === 'profiles') return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { name: 'Ada' } }) })) })),
      };
      if (table === 'task_chat_messages') return { insert };
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await sendTaskChatMessage({ taskId: 'task-2', projectId: 'ignored', body: 'Standalone' });

    expect(result.projectId).toBeNull();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: null }));
  });

  test('surfaces history loading errors', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } }) })),
      })),
    });

    await expect(listTaskChatMessages('task-1')).rejects.toThrow('offline');
  });
});
