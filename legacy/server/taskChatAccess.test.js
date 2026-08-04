import { describe, expect, test } from 'vitest';
import { canSendTaskChatNotification, filterTaskMentionRecipients } from './taskChatAccess.js';

const task = {
  id: 'task-1',
  project_id: 'project-1',
  owner_id: 'task-owner',
  assignees: [{ id: 'assignee-1' }, { id: 'assignee-2' }],
};
const project = { id: 'project-1', owner_id: 'project-owner', team: [{ id: 'project-member' }] };

describe('task chat notification authorization', () => {
  test('allows project membership and task assignment only for the task actual project', () => {
    expect(canSendTaskChatNotification({ userId: 'project-owner', task, project })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'project-member', task, project })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'resource-user', task, project, projectResourceUserIds: ['resource-user'] })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'assignee-1', task, project })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'project-owner', task, project: { ...project, id: 'other' } })).toBe(false);
    expect(canSendTaskChatNotification({ userId: 'stranger', task, project })).toBe(false);
  });

  test('allows standalone task owner, assignees, and explicit task access', () => {
    const standalone = { ...task, project_id: null };
    expect(canSendTaskChatNotification({ userId: 'task-owner', task: standalone, project: null })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'assignee-1', task: standalone, project: null })).toBe(true);
    expect(canSendTaskChatNotification({ userId: 'invitee', task: standalone, project: null, explicitTaskUserIds: ['invitee'] })).toBe(true);
  });
});

describe('task mention recipient filtering', () => {
  test('keeps only task team members, excluding sender, duplicates, and unrelated project members when no project is given', () => {
    expect(filterTaskMentionRecipients({
      senderId: 'assignee-1',
      mentionedUserIds: ['assignee-1', 'assignee-2', 'project-member', 'invitee', 'assignee-2', 42],
      task,
      explicitTaskUserIds: ['invitee'],
    })).toEqual(['assignee-2', 'invitee']);
  });

  test('includes the project owner, project team members, and active project resources alongside task assignees and explicit access', () => {
    expect(filterTaskMentionRecipients({
      senderId: 'assignee-1',
      mentionedUserIds: ['project-owner', 'project-member', 'resource-user', 'assignee-2', 'invitee', 'stranger'],
      task,
      project,
      projectResourceUserIds: ['resource-user'],
      explicitTaskUserIds: ['invitee'],
    })).toEqual(['project-owner', 'project-member', 'resource-user', 'assignee-2', 'invitee']);
  });

  test('deduplicates repeated ids and excludes the sender even when mentioned', () => {
    expect(filterTaskMentionRecipients({
      senderId: 'project-owner',
      mentionedUserIds: ['project-owner', 'project-member', 'project-member', 'assignee-1', 'assignee-1'],
      task,
      project,
    })).toEqual(['project-member', 'assignee-1']);
  });

  test('excludes strangers who are neither project members nor task team members', () => {
    expect(filterTaskMentionRecipients({
      senderId: 'assignee-1',
      mentionedUserIds: ['stranger'],
      task,
      project,
      projectResourceUserIds: ['resource-user'],
    })).toEqual([]);
  });
});
