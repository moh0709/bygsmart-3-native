import { describe, expect, test } from 'vitest';
import { canGrantTaskInvite } from './taskInviteAccess.js';

const projectTask = { id: 'task-1', project_id: 'project-1', owner_id: null };
const project = { id: 'project-1', owner_id: 'project-owner', team: [{ id: 'manager-1', role: 'MANAGER' }, { id: 'employee-1', role: 'EMPLOYEE' }] };
const quickTask = { id: 'task-2', project_id: null, owner_id: 'quick-owner' };

describe('canGrantTaskInvite', () => {
  test('project owner and MANAGER can grant; a plain EMPLOYEE cannot', () => {
    expect(canGrantTaskInvite({ userId: 'project-owner', task: projectTask, project })).toBe(true);
    expect(canGrantTaskInvite({ userId: 'manager-1', task: projectTask, project })).toBe(true);
    expect(canGrantTaskInvite({ userId: 'employee-1', task: projectTask, project })).toBe(false);
  });

  test('quick task owner can grant; a stranger cannot', () => {
    expect(canGrantTaskInvite({ userId: 'quick-owner', task: quickTask, project: null })).toBe(true);
    expect(canGrantTaskInvite({ userId: 'stranger', task: quickTask, project: null })).toBe(false);
  });

  test('an explicit owner/responsible quick_task_access grant overrides the default (e.g. promotes a project EMPLOYEE for one task)', () => {
    expect(canGrantTaskInvite({ userId: 'employee-1', task: projectTask, project, explicitGrantRole: 'responsible' })).toBe(true);
    expect(canGrantTaskInvite({ userId: 'employee-1', task: projectTask, project, explicitGrantRole: 'worker' })).toBe(false);
  });

  test('missing userId or task never grants', () => {
    expect(canGrantTaskInvite({ userId: null, task: quickTask, project: null })).toBe(false);
    expect(canGrantTaskInvite({ userId: 'quick-owner', task: null, project: null })).toBe(false);
  });
});
