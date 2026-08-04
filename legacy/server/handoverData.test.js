import { describe, expect, test } from 'vitest';
import {
  assigneesContainmentValue,
  isAssignedTo,
  deriveProjectRole,
} from './handoverData.js';

describe('handover assignee containment', () => {
  test('builds a JSONB array containment value (mirrors @> [{id}])', () => {
    expect(assigneesContainmentValue('u-1')).toBe('[{"id":"u-1"}]');
    // Must be a JSON *array* of objects — the shape Postgres `@>` expects.
    const parsed = JSON.parse(assigneesContainmentValue('u-1'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toEqual({ id: 'u-1' });
  });

  test('isAssignedTo matches the assignees object array, not a string', () => {
    const assignees = [
      { id: 'u-1', initials: 'AB', name: 'Anna B' },
      { id: 'u-2', initials: 'CD', name: 'Carl D' },
    ];
    expect(isAssignedTo(assignees, 'u-2')).toBe(true);
    expect(isAssignedTo(assignees, 'u-9')).toBe(false);
    expect(isAssignedTo(null, 'u-1')).toBe(false);
    expect(isAssignedTo('[{"id":"u-1"}]', 'u-1')).toBe(false);
  });
});

describe('handover project role derivation', () => {
  const userId = 'u-1';

  test('owner relationship wins', () => {
    expect(deriveProjectRole({ project: { owner_id: 'u-1', team: [] }, userId, visibility: 'none' }))
      .toBe('OWNER');
  });

  test('uses mirrored projects.team role when present', () => {
    const project = { owner_id: 'owner', team: [{ id: 'u-1', role: 'MANAGER' }] };
    expect(deriveProjectRole({ project, userId, visibility: 'standard' })).toBe('MANAGER');
  });

  test('falls back to visibility→role mapping when no team entry', () => {
    expect(deriveProjectRole({ project: { owner_id: 'owner', team: [] }, userId, visibility: 'all' }))
      .toBe('MANAGER');
    expect(deriveProjectRole({ project: { owner_id: 'owner', team: [] }, userId, visibility: 'standard' }))
      .toBe('EMPLOYEE');
  });
});
