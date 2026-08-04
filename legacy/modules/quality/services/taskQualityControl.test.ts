import { beforeEach, describe, expect, test, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
}));

vi.mock('../../../services/supabaseClient', () => ({
  supabase: {
    from: supabaseMocks.from,
    storage: { from: supabaseMocks.storageFrom },
  },
}));

vi.mock('../../field', () => ({ uploadTaskFile: vi.fn(), uploadSignature: vi.fn() }));

import { deleteTaskQualityControl, listTaskQualityControls } from './taskQualityControl';

describe('taskQualityControl service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.storageFrom.mockReturnValue({ remove: supabaseMocks.storageRemove });
    supabaseMocks.storageRemove.mockResolvedValue({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  test('throws when quality controls cannot be loaded', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'network unavailable' } });
    supabaseMocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ order })),
      })),
    });

    await expect(listTaskQualityControls('task-1')).rejects.toThrow('network unavailable');
  });

  test('does not remove evidence when row deletion is rejected', async () => {
    const denied = { message: 'delete denied by RLS' };
    const deleteSingle = vi.fn().mockResolvedValue({ data: null, error: denied });
    const deleteResult = {
      select: vi.fn(() => ({ single: deleteSingle })),
      then: (resolve: (value: { data: null; error: typeof denied }) => unknown) => resolve({ data: null, error: denied }),
    };
    const preDeleteSingle = vi.fn().mockResolvedValue({
      data: {
        deviation_photos: [{ storagePath: 'task-docs/project-1/task-1/photo.jpg' }],
        signature_path: 'task-docs/signatures/user-1/signature.png',
      },
      error: null,
    });

    supabaseMocks.from.mockReturnValue({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: preDeleteSingle })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => deleteResult) })),
    });

    await expect(deleteTaskQualityControl('control-1')).rejects.toThrow('delete denied by RLS');
    expect(supabaseMocks.storageRemove).not.toHaveBeenCalled();
  });

  test('cleans up evidence returned by the successful row deletion', async () => {
    const deletedRow = {
      deviation_photos: [{ storagePath: 'task-docs/project-1/task-1/photo.jpg' }],
      signature_path: 'task-docs/signatures/user-1/signature.png',
    };
    const deleteSingle = vi.fn().mockResolvedValue({ data: deletedRow, error: null });
    const preDeleteSelect = vi.fn(() => {
      throw new Error('evidence was fetched before authorization');
    });

    supabaseMocks.from.mockReturnValue({
      select: preDeleteSelect,
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single: deleteSingle })),
        })),
      })),
    });

    await deleteTaskQualityControl('control-1');

    expect(preDeleteSelect).not.toHaveBeenCalled();
    expect(supabaseMocks.storageRemove).toHaveBeenCalledWith([
      'project-1/task-1/photo.jpg',
      'signatures/user-1/signature.png',
    ]);
  });
});
