import React from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
  subscribe: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../services/taskChat', () => ({
  listTaskChatMessages: mocks.list,
  sendTaskChatMessage: mocks.send,
  subscribeToTaskChat: mocks.subscribe,
  notifyMentions: mocks.notify,
}));

vi.mock('../../../components/FilePicker', () => ({ default: () => <button type="button">Foto</button> }));

import TaskChatTab from './TaskChatTab';

const team = [
  { id: 'user-1', name: 'Ada', initials: 'AD', role: 'EMPLOYEE' as const, status: 'ACTIVE' as const, joinedAt: '' },
  { id: 'user-2', name: 'Anna Jensen', initials: 'AJ', role: 'EMPLOYEE' as const, status: 'ACTIVE' as const, joinedAt: '' },
];

describe('TaskChatTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.list.mockResolvedValue([]);
    mocks.subscribe.mockReturnValue(() => undefined);
    mocks.notify.mockResolvedValue(undefined);
  });

  test('loads history and highlights mentions recorded on the message', async () => {
    mocks.list.mockResolvedValue([{
      id: 'message-1', taskId: 'task-1', projectId: 'project-1', senderId: 'user-2',
      senderName: 'Anna Jensen', body: 'Hej @Ada', mentions: ['user-1'], createdAt: '2026-07-03T10:00:00Z',
    }]);

    render(<TaskChatTab taskId="task-1" projectId="project-1" projectTeam={team} currentUserId="user-1" currentUserName="Ada" />);

    expect(await screen.findByText('Anna Jensen')).toBeInTheDocument();
    expect(screen.getByText('@Ada').tagName).toBe('MARK');
  });

  test('selects only task-team mentions and notifies after the optimistic send is saved', async () => {
    mocks.send.mockResolvedValue({
      id: 'message-2', taskId: 'task-1', projectId: 'project-1', senderId: 'user-1',
      senderName: 'Ada', body: '@Anna Jensen status?', mentions: ['user-2'], createdAt: '2026-07-03T10:01:00Z',
    });
    const user = userEvent.setup();
    render(<TaskChatTab taskId="task-1" projectId="project-1" projectTeam={team} currentUserId="user-1" currentUserName="Ada" />);

    await user.type(screen.getByLabelText('Besked'), '@Ann');
    await user.click(await screen.findByRole('button', { name: /Anna Jensen/ }));
    await user.type(screen.getByLabelText('Besked'), 'status?');
    await user.click(screen.getByRole('button', { name: 'Send besked' }));

    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      mentions: ['user-2'],
      body: '@Anna Jensen status?',
    })));
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      mentionedUserIds: ['user-2'],
      link: '/task/task-1',
    }));
  });
});
