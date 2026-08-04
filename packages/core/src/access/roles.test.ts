// TEST LAYER 2 — task-access role precedence. Ported from legacy/modules/field/components/roles.test.ts.
import { describe, expect, test } from 'vitest';
import type { Project, Task } from '../types';
import { computeTaskRole, initialDisplayModeFor, maxModeForRole } from './roles';

const projectTask = { projectId: 'project-1', ownerId: undefined, assignees: [{ id: 'worker-1', name: 'W', initials: 'W' }] } as unknown as Task;
const quickTask = { projectId: undefined, ownerId: 'owner-1', assignees: [{ id: 'worker-1', name: 'W', initials: 'W' }] } as unknown as Task;

const project: Project = {
  ownerId: 'owner-1',
  team: [
    { id: 'owner-1', role: 'OWNER' },
    { id: 'manager-1', role: 'MANAGER' },
    { id: 'employee-1', role: 'EMPLOYEE' },
  ],
};

describe('computeTaskRole — project tasks', () => {
  test('project owner is owner', () => {
    expect(computeTaskRole({ task: projectTask, project, userId: 'owner-1' })).toBe('owner');
  });
  test('project MANAGER is responsible', () => {
    expect(computeTaskRole({ task: projectTask, project, userId: 'manager-1' })).toBe('responsible');
  });
  test('an assignee is worker', () => {
    expect(computeTaskRole({ task: projectTask, project, userId: 'worker-1' })).toBe('worker');
  });
  test('a project member who is not assigned is viewer', () => {
    expect(computeTaskRole({ task: projectTask, project, userId: 'employee-1' })).toBe('viewer');
  });
  test('someone outside the project has no role', () => {
    expect(computeTaskRole({ task: projectTask, project, userId: 'stranger-1' })).toBeNull();
  });
  test('an explicit quick_task_access row overrides the project-derived default', () => {
    const role = computeTaskRole({
      task: projectTask, project, userId: 'employee-1',
      accessRows: [{ userId: 'employee-1', role: 'responsible', status: 'active' }],
    });
    expect(role).toBe('responsible');
  });
});

describe('computeTaskRole — quick tasks', () => {
  test('tasks.ownerId is owner', () => {
    expect(computeTaskRole({ task: quickTask, userId: 'owner-1' })).toBe('owner');
  });
  test('an assignee is worker', () => {
    expect(computeTaskRole({ task: quickTask, userId: 'worker-1' })).toBe('worker');
  });
  test('no access without an explicit grant', () => {
    expect(computeTaskRole({ task: quickTask, userId: 'stranger-1' })).toBeNull();
  });
  test('a pending quick_task_access grant is honored (not just active)', () => {
    const role = computeTaskRole({
      task: quickTask, userId: 'delegate-1',
      accessRows: [{ userId: 'delegate-1', role: 'viewer', status: 'pending' }],
    });
    expect(role).toBe('viewer');
  });
  test('a declined row grants no role', () => {
    const role = computeTaskRole({
      task: quickTask, userId: 'delegate-1',
      accessRows: [{ userId: 'delegate-1', role: 'worker', status: 'declined' }],
    });
    expect(role).toBeNull();
  });
});

describe('maxModeForRole / initialDisplayModeFor', () => {
  test('owner/responsible can reach edit', () => {
    expect(maxModeForRole('owner')).toBe('edit');
    expect(maxModeForRole('responsible')).toBe('edit');
  });
  test('worker caps at work', () => {
    expect(maxModeForRole('worker')).toBe('work');
  });
  test('viewer and null cap at view', () => {
    expect(maxModeForRole('viewer')).toBe('view');
    expect(maxModeForRole(null)).toBe('view');
  });

  test('opening an existing task always lands in the read view, even for an owner', () => {
    expect(initialDisplayModeFor({ id: 'task-1' } as Task, 'owner')).toBe('work');
    expect(initialDisplayModeFor({ id: 'task-1' } as Task, 'responsible')).toBe('work');
    expect(initialDisplayModeFor({ id: 'task-1' } as Task, 'worker')).toBe('work');
    expect(initialDisplayModeFor({ id: 'task-1' } as Task, 'viewer')).toBe('view');
  });
  test('a brand-new task (no id) opens directly in edit', () => {
    expect(initialDisplayModeFor(undefined, 'owner')).toBe('edit');
    expect(initialDisplayModeFor({ id: '' } as Task, null)).toBe('edit');
  });
});
