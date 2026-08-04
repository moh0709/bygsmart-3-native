// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Project, Task } from '../../../types';
import { TaskFormModal } from './TaskFormModal';

vi.mock('../../../contexts/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Ole Owner', initials: 'OO' } }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

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

vi.mock('../../../modules/field', () => ({
  TaskChatTab: () => null,
  TaskChatUnreadBadge: () => null,
}));

vi.mock('../../../modules/quality', () => ({
  TaskQualityControlTab: (props: Record<string, unknown>) => (
    <div data-testid="quality-control-props">{JSON.stringify(props)}</div>
  ),
}));

const project = {
  id: 'project-1', ownerId: 'owner-1', projectNumber: 'P-204', name: 'Villa Nord',
  team: [{ id: 'owner-1', name: 'Ole Owner', initials: 'OO', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-01-01' }],
} as Project;

const task = {
  id: 'task-1', title: 'Monter vinduer', status: 'To Do', dueDate: '2026-07-10',
  assignees: [], projectId: 'project-1', ownerId: 'owner-1',
} as Task;

describe('TaskFormModal quality control tab', () => {
  test('renders the quality control workspace for a saved project task', async () => {
    render(
      <TaskFormModal
        task={task}
        project={project}
        projectTeam={project.team}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /kvalitetssikring/i }));

    // TaskQualityControlTab is lazy-loaded (avoids a static modules/tools ↔
    // modules/tasks chunk cycle), so it resolves behind a Suspense boundary.
    const props = (await screen.findByTestId('quality-control-props')).textContent ?? '';
    expect(props).toContain('"taskId":"task-1"');
    expect(props).toContain('"projectId":"project-1"');
    expect(props).toContain('"currentUserId":"owner-1"');
    expect(props).toContain('"currentUserName":"Ole Owner"');
    expect(props).toContain('"isOwnerOrManager":true');
  });
});
