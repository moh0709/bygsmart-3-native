import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Project, Task } from '../../../types';

vi.mock('../../../contexts/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Ole Owner', initials: 'OO' } }),
}));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../../services/api', () => ({ getUserConnections: vi.fn(async () => []), getProfileById: vi.fn(async () => null) }));
vi.mock('../../../modules/ai', () => ({
  findRelevantRegulationsForTask: vi.fn(async () => []), searchRegulationsWithAI: vi.fn(async () => []),
  optimizeTaskWithAI: vi.fn(async () => ''), generateChecklistFromDescription: vi.fn(async () => []),
  QuotaExceededError: class QuotaExceededError extends Error {},
}));
vi.mock('../../../modules/field', () => ({
  TaskChatTab: (props: Record<string, unknown>) => <div data-testid="task-chat-props">{JSON.stringify(props)}</div>,
  TaskChatUnreadBadge: () => <span aria-label="3 ulæste beskeder">3</span>,
}));
vi.mock('../../../modules/quality', () => ({ TaskQualityControlTab: () => null }));

import { TaskFormModal } from './TaskFormModal';

const project = {
  id: 'project-1', ownerId: 'owner-1', projectNumber: 'P-204', name: 'Villa Nord',
  team: [
    { id: 'owner-1', name: 'Ole Owner', initials: 'OO', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-01-01' },
    { id: 'assigned-1', name: 'Anna', initials: 'AN', role: 'EMPLOYEE', status: 'ACTIVE', joinedAt: '2026-01-01' },
    { id: 'unrelated-1', name: 'Ulla', initials: 'UL', role: 'EMPLOYEE', status: 'ACTIVE', joinedAt: '2026-01-01' },
  ],
} as Project;
const task = {
  id: 'task-1', title: 'Monter vinduer', status: 'To Do', dueDate: '2026-07-10',
  assignees: [{ id: 'assigned-1', name: 'Anna', initials: 'AN' }], projectId: 'project-1', ownerId: 'owner-1',
} as Task;

describe('TaskFormModal chat tab', () => {
  test('shows the unread badge and passes the full project team to a saved chat', async () => {
    render(<TaskFormModal task={task} project={project} projectTeam={project.team} onClose={vi.fn()} onSave={vi.fn()} />);
    // Chat pieces are lazy (field is loaded via dynamic import) -> findBy*.
    expect(await screen.findByLabelText('3 ulæste beskeder')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    const props = (await screen.findByTestId('task-chat-props')).textContent ?? '';
    expect(props).toContain('owner-1');
    expect(props).toContain('assigned-1');
    expect(props).toContain('unrelated-1');
  });

  test('asks the user to save before starting chat', () => {
    render(<TaskFormModal project={project} projectTeam={project.team} onClose={vi.fn()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    expect(screen.getByText('Gem opgaven først for at starte chatten.')).toBeInTheDocument();
  });
});
