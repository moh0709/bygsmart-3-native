import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Project, Task } from '../../../types';

// Same context/service mocks as the sibling TaskFormModal tests.
vi.mock('../../../contexts/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Ole Owner', initials: 'OO' } }),
}));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../../services/api', () => ({
  getUserConnections: vi.fn(async () => []),
  getProfileById: vi.fn(async () => null),
}));
vi.mock('../../../modules/ai', () => ({
  findRelevantRegulationsForTask: vi.fn(async () => []),
  searchRegulationsWithAI: vi.fn(async () => []),
  optimizeTaskWithAI: vi.fn(async () => ''),
  generateChecklistFromDescription: vi.fn(async () => []),
  QuotaExceededError: class QuotaExceededError extends Error {},
}));
vi.mock('../../../modules/field', () => ({ TaskChatTab: () => null, TaskChatUnreadBadge: () => null }));
vi.mock('../../../modules/quality', () => ({ TaskQualityControlTab: () => null }));

import { TaskFormModal } from './TaskFormModal';

const project = {
  id: 'project-1', ownerId: 'owner-1', projectNumber: 'P-1', name: 'Villa Nord',
  team: [{ id: 'owner-1', name: 'Ole Owner', initials: 'OO', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-01-01' }],
} as Project;

const task = {
  id: 'task-1', title: 'Monter vinduer', status: 'To Do', priority: 'Mellem', dueDate: '2026-07-10',
  assignees: [], projectId: 'project-1', ownerId: 'owner-1', comments: [],
} as unknown as Task;

describe('TaskFormModal save (characterization)', () => {
  test('emits the updated payload + a change-log comment when the title changes', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <TaskFormModal task={task} project={project} projectTeam={project.team} onClose={onClose} onSave={onSave} />
    );

    // The description ("beskrivelse") tab is the default view — edit the title, then save.
    fireEvent.change(screen.getByPlaceholderText('Opgavetitel'), { target: { value: 'Monter døre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gem' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, id] = onSave.mock.calls[0];
    expect(id).toBe('task-1');
    expect(payload.title).toBe('Monter døre');
    expect(payload.status).toBe('To Do');
    expect(payload.dueDate).toBe('2026-07-10');

    const logTexts = (payload.comments as Array<{ type: string; text: string }>)
      .filter(c => c.type === 'log')
      .map(c => c.text);
    expect(logTexts).toContain('Titel ændret til "Monter døre"');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
