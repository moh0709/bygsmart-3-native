// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Project, ProjectMember, Task, TaskQualityControl } from '../../../types';
import TaskQualityControlTab from './TaskQualityControlTab';

const serviceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  uploadFile: vi.fn(),
  uploadSignature: vi.fn(),
}));

const showToast = vi.hoisted(() => vi.fn());

vi.mock('../services/taskQualityControl', () => ({
  listTaskQualityControls: serviceMocks.list,
  addTaskQualityControl: serviceMocks.add,
  updateTaskQualityControl: serviceMocks.update,
  deleteTaskQualityControl: serviceMocks.remove,
  uploadTaskFile: serviceMocks.uploadFile,
  uploadSignature: serviceMocks.uploadSignature,
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../../utils/fileUtils', () => ({
  processFileForStorage: vi.fn(async () => ({
    dataUrl: 'data:image/jpeg;base64,cGhvdG8=',
    name: 'photo.jpg',
    type: 'image/jpeg',
  })),
  resolveFileUrl: vi.fn(async (path: string) => `https://files.test/${path}`),
}));

vi.mock('../../../components/FilePicker', () => ({
  default: ({ onFileSelect }: { onFileSelect: (file: File) => void }) => (
    <button type="button" onClick={() => onFileSelect(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))}>
      Vælg foto
    </button>
  ),
}));

vi.mock('../../../components/SignatureCanvas', () => ({
  default: ({ onSignatureChange }: { onSignatureChange: (value: string) => void }) => (
    <button type="button" onClick={() => onSignatureChange('data:image/png;base64,c2ln')}>
      Tegn signatur
    </button>
  ),
}));

const task = {
  id: 'task-1', title: 'Monter vinduer', status: 'To Do', dueDate: '2026-07-10', assignees: [], projectId: 'project-1',
} as Task;

const project = {
  id: 'project-1', name: 'Villa Nord', projectNumber: 'P-204', team: [],
} as Project;

const projectTeam = [
  { id: '22222222-2222-4222-8222-222222222222', name: 'Nina Nielsen', initials: 'NN', role: 'EMPLOYEE', status: 'ACTIVE', joinedAt: '2026-01-01' },
  { id: 'pending@example.com', name: 'Pia Pending', initials: 'PP', role: 'EMPLOYEE', status: 'PENDING', joinedAt: '2026-07-01' },
] as ProjectMember[];

const renderTab = () => render(
  <TaskQualityControlTab
    taskId="task-1"
    projectId="project-1"
    task={task}
    project={project}
    projectTeam={projectTeam}
    currentUserId="worker-1"
    currentUserName="Mads Mester"
    isOwnerOrManager={false}
  />
);

describe('TaskQualityControlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.list.mockResolvedValue([]);
    serviceMocks.add.mockResolvedValue({ id: 'control-new' });
    serviceMocks.update.mockResolvedValue({ id: 'control-1' });
    serviceMocks.remove.mockResolvedValue(undefined);
    serviceMocks.uploadFile.mockResolvedValue('task-docs/project-1/task-1/photo.jpg');
    serviceMocks.uploadSignature.mockResolvedValue('task-docs/signatures/signature.png');
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) })));
  });

  test('creates a control with deviation evidence, responsible member, and signature', async () => {
    renderTab();

    expect(await screen.findByText('Ingen kontroller endnu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /opret ny kontrol/i }));

    expect(screen.getByText('Monter vinduer')).toBeInTheDocument();
    expect(screen.getByText(/Villa Nord.*P-204/)).toBeInTheDocument();
    expect(screen.getByText('Mads Mester')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Kontrolpunkt/aktivitet'), { target: { value: 'Fugebredde' } });
    fireEvent.change(screen.getByLabelText('Krav/reference'), { target: { value: 'BR18 § 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
    fireEvent.change(screen.getByLabelText('Beskrivelse'), { target: { value: 'Fugen er for bred' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vælg foto' }));
    await waitFor(() => expect(serviceMocks.uploadFile).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Udbedring/korrigerende handling'), { target: { value: 'Fugen udskiftes' } });
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2026-07-12' } });
    fireEvent.change(screen.getByLabelText('Ansvarlig'), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tegn signatur' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gem kontrol' }));

    await waitFor(() => expect(serviceMocks.add).toHaveBeenCalledTimes(1));
    expect(serviceMocks.add).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      projectId: 'project-1',
      authorId: 'worker-1',
      authorName: 'Mads Mester',
      controlPoint: 'Fugebredde',
      requirementRef: 'BR18 § 123',
      hasDeviation: true,
      deviationDescription: 'Fugen er for bred',
      correctiveAction: 'Fugen udskiftes',
      deviationDeadline: '2026-07-12',
      responsibleId: '22222222-2222-4222-8222-222222222222',
      responsibleName: 'Nina Nielsen',
      signaturePath: 'task-docs/signatures/signature.png',
      deviationPhotos: [{
        storagePath: 'task-docs/project-1/task-1/photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      }],
    }));
    expect(showToast).toHaveBeenCalledWith('Kontrol gemt', 'success');
  });

  test('only offers active profile-backed members as responsible people', async () => {
    renderTab();
    expect(await screen.findByText('Ingen kontroller endnu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /opret ny kontrol/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));

    expect(screen.getByRole('option', { name: 'Nina Nielsen' })).toHaveValue('22222222-2222-4222-8222-222222222222');
    expect(screen.queryByRole('option', { name: 'Pia Pending' })).not.toBeInTheDocument();
  });

  test('keeps saving disabled until every selected photo has uploaded', async () => {
    let resolveFirst!: (path: string) => void;
    let resolveSecond!: (path: string) => void;
    serviceMocks.uploadFile
      .mockImplementationOnce(() => new Promise<string>(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<string>(resolve => { resolveSecond = resolve; }));

    renderTab();
    expect(await screen.findByText('Ingen kontroller endnu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /opret ny kontrol/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vælg foto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vælg foto' }));

    await waitFor(() => expect(serviceMocks.uploadFile).toHaveBeenCalledTimes(2));
    const saveButton = screen.getByRole('button', { name: 'Gem kontrol' });
    expect(saveButton).toBeDisabled();

    await act(async () => { resolveFirst('task-docs/project-1/task-1/first.jpg'); });
    expect(saveButton).toBeDisabled();

    await act(async () => { resolveSecond('task-docs/project-1/task-1/second.jpg'); });
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  test('shows a visible error instead of an empty state when loading fails', async () => {
    serviceMocks.list.mockRejectedValue(new Error('KS kunne ikke hentes'));

    renderTab();

    expect(await screen.findByText('Kunne ikke hente kontroller')).toBeInTheDocument();
    expect(screen.queryByText('Ingen kontroller endnu')).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('KS kunne ikke hentes', 'error');
  });

  test('allows an author to edit and delete their saved control', async () => {
    const savedControl = {
      id: 'control-1', taskId: 'task-1', projectId: 'project-1', authorId: 'worker-1', authorName: 'Mads Mester',
      controlPoint: 'Karmmål', controlType: 'maaling', result: 'godkendt', hasDeviation: false,
      deviationPhotos: [], controlDate: '2026-07-03', createdAt: '2026-07-03T08:00:00Z',
    } as TaskQualityControl;
    serviceMocks.list.mockResolvedValue([savedControl]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderTab();
    expect(await screen.findByText('Karmmål')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rediger Karmmål' }));
    fireEvent.change(screen.getByLabelText('Kommentarer'), { target: { value: 'Kontrolleret igen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gem kontrol' }));

    await waitFor(() => expect(serviceMocks.update).toHaveBeenCalledWith(
      'control-1',
      expect.objectContaining({ comments: 'Kontrolleret igen' })
    ));

    serviceMocks.list.mockResolvedValue([savedControl]);
    await waitFor(() => expect(screen.getByText('Karmmål')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Slet Karmmål' }));
    await waitFor(() => expect(serviceMocks.remove).toHaveBeenCalledWith('control-1'));
  });
});
