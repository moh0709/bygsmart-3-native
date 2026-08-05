import { describe, it, expect } from 'vitest';
import { topoSort, conflictPolicy, type Mutation } from './mutations';

const m = (id: string, dependsOn?: string[]): Mutation => ({
  id,
  entity: 'tasks',
  op: 'upsert',
  data: { id },
  dependsOn,
});

describe('topoSort', () => {
  it('orders dependencies before dependents', () => {
    const out = topoSort([m('child', ['parent']), m('parent')]).map((x) => x.id);
    expect(out.indexOf('parent')).toBeLessThan(out.indexOf('child'));
  });

  it('is stable for independent mutations (input order preserved)', () => {
    expect(topoSort([m('a'), m('b'), m('c')]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles a diamond', () => {
    const out = topoSort([m('d', ['b', 'c']), m('b', ['a']), m('c', ['a']), m('a')]).map((x) => x.id);
    expect(out.indexOf('a')).toBeLessThan(out.indexOf('b'));
    expect(out.indexOf('a')).toBeLessThan(out.indexOf('c'));
    expect(out.indexOf('b')).toBeLessThan(out.indexOf('d'));
    expect(out.indexOf('c')).toBeLessThan(out.indexOf('d'));
  });

  it('throws on a cycle', () => {
    expect(() => topoSort([m('x', ['y']), m('y', ['x'])])).toThrow(/cycle/);
  });

  it('throws on an unknown dependency', () => {
    expect(() => topoSort([m('x', ['ghost'])])).toThrow(/unknown/);
  });
});

describe('conflictPolicy', () => {
  it('defaults to reject', () => {
    expect(conflictPolicy('projects')).toBe('reject');
    expect(conflictPolicy('tasks')).toBe('reject');
  });
  it('is last-write-wins for high-churn low-stakes entities', () => {
    expect(conflictPolicy('task_check_ins')).toBe('lww');
    expect(conflictPolicy('activity_log')).toBe('lww');
  });
});
