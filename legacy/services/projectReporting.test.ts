import { beforeEach, describe, expect, test, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('./supabaseClient', () => ({
  supabase: { from: supabaseMocks.from },
}));

import { getHandoversForProject, getQualityControlsForProject } from './projectReporting';

// Builder for the `select().eq().order()` chain used by the QC + handover loaders.
const selectEqOrder = (result: unknown) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve(result)),
    })),
  })),
});

// Builder for the `select().in()` chain used to resolve profile names.
const selectIn = (result: unknown, capture?: (ids: unknown) => void) => ({
  select: vi.fn(() => ({
    in: vi.fn((_column: string, ids: unknown) => {
      capture?.(ids);
      return Promise.resolve(result);
    }),
  })),
});

describe('projectReporting loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  // ── getQualityControlsForProject ───────────────────────────────────────────

  test('getQualityControlsForProject returns [] for a project with no controls', async () => {
    supabaseMocks.from.mockReturnValue(selectEqOrder({ data: [], error: null }));
    await expect(getQualityControlsForProject('project-1')).resolves.toEqual([]);
    expect(supabaseMocks.from).toHaveBeenCalledWith('task_quality_controls');
  });

  test('getQualityControlsForProject maps snake_case rows and applies defaults for partial data', async () => {
    const row = {
      id: 'qc-1',
      task_id: 'task-1',
      project_id: 'project-1',
      author_id: 'user-1',
      author_name: 'Mads Mester',
      requirement_ref: 'BR18 § 123',
      result: 'ikke_godkendt',
      // has_deviation, deviation_photos, responsible_name intentionally absent
      control_date: '2026-07-03',
      created_at: '2026-07-03T08:00:00Z',
    };
    supabaseMocks.from.mockReturnValue(selectEqOrder({ data: [row], error: null }));

    const [qc] = await getQualityControlsForProject('project-1');
    expect(qc.id).toBe('qc-1');
    expect(qc.taskId).toBe('task-1');
    expect(qc.projectId).toBe('project-1');
    expect(qc.requirementRef).toBe('BR18 § 123');
    expect(qc.result).toBe('ikke_godkendt');
    expect(qc.hasDeviation).toBe(false); // default
    expect(qc.deviationPhotos).toEqual([]); // default
    expect(qc.responsibleName).toBeUndefined();
  });

  test('getQualityControlsForProject returns [] and logs on a query error', async () => {
    supabaseMocks.from.mockReturnValue(
      selectEqOrder({ data: null, error: { message: 'network unavailable' } })
    );
    await expect(getQualityControlsForProject('project-1')).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  // ── getHandoversForProject ─────────────────────────────────────────────────

  test('getHandoversForProject returns [] and skips the profiles lookup when empty', async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'task_handovers') return selectEqOrder({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    await expect(getHandoversForProject('project-1')).resolves.toEqual([]);
    expect(supabaseMocks.from).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.from).toHaveBeenCalledWith('task_handovers');
  });

  test('getHandoversForProject resolves party names and only queries distinct ids', async () => {
    const rows = [
      {
        id: 'ho-1', task_id: 'task-1', project_id: 'project-1',
        submitted_by: 'worker-1', reviewed_by: 'mester-1',
        supplier_signature_path: 'task-docs/sig-a.png',
        mester_signature_path: 'task-docs/sig-b.png',
        status: 'accepted', created_at: '2026-07-05T10:00:00Z',
      },
      {
        id: 'ho-2', task_id: 'task-2', project_id: 'project-1',
        submitted_by: 'worker-1', reviewed_by: null, // not yet reviewed
        status: 'submitted', created_at: '2026-07-04T10:00:00Z',
      },
    ];
    let capturedIds: unknown;
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'task_handovers') return selectEqOrder({ data: rows, error: null });
      if (table === 'profiles') {
        return selectIn(
          { data: [{ id: 'worker-1', name: 'Wanda Worker' }, { id: 'mester-1', name: 'Mads Mester' }], error: null },
          ids => { capturedIds = ids; }
        );
      }
      throw new Error(`unexpected table ${table}`);
    });

    const handovers = await getHandoversForProject('project-1');

    expect(handovers).toHaveLength(2);
    expect(handovers[0]).toMatchObject({
      id: 'ho-1',
      taskId: 'task-1',
      status: 'accepted',
      submittedBy: 'worker-1',
      reviewedBy: 'mester-1',
      supplierSignaturePath: 'task-docs/sig-a.png',
      mesterSignaturePath: 'task-docs/sig-b.png',
      submittedByName: 'Wanda Worker',
      reviewedByName: 'Mads Mester',
    });
    expect(handovers[1].submittedByName).toBe('Wanda Worker');
    expect(handovers[1].reviewedByName).toBeUndefined(); // reviewed_by was null

    // De-duplicated: worker-1 appears twice in the rows but only once in the lookup.
    expect(capturedIds).toEqual(['worker-1', 'mester-1']);
  });

  test('getHandoversForProject still returns handovers when the profiles lookup fails', async () => {
    const rows = [
      { id: 'ho-1', task_id: 'task-1', project_id: 'project-1', submitted_by: 'worker-1', status: 'submitted', created_at: '2026-07-05T10:00:00Z' },
    ];
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'task_handovers') return selectEqOrder({ data: rows, error: null });
      if (table === 'profiles') return selectIn({ data: null, error: { message: 'profiles denied' } });
      throw new Error(`unexpected table ${table}`);
    });

    const handovers = await getHandoversForProject('project-1');
    expect(handovers).toHaveLength(1);
    expect(handovers[0].submittedByName).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  test('getHandoversForProject returns [] on a handover query error', async () => {
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'task_handovers') return selectEqOrder({ data: null, error: { message: 'boom' } });
      throw new Error(`unexpected table ${table}`);
    });
    await expect(getHandoversForProject('project-1')).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
