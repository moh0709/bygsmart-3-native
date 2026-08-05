import { describe, it, expect, vi } from 'vitest';
import { InMemoryRepository } from './memory';
import { hydrate, pullEntity, type PullPage, type PullSource } from './puller';
import type { Row } from './contract';

const row = (id: string): Row => ({ id, updated_at: '2026-01-01T00:00:00Z' });

/** A fake source that serves pre-scripted pages per entity. */
function scriptedSource(script: Record<string, PullPage[]>): PullSource & { calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  return {
    calls,
    async fetch(entity, _cursor) {
      const i = calls[entity] ?? 0;
      calls[entity] = i + 1;
      return script[entity]![i]!;
    },
  };
}

describe('pullEntity', () => {
  it('drains all pages, applies rows, and advances the cursor', async () => {
    const repo = new InMemoryRepository();
    const source = scriptedSource({
      tasks: [
        { rows: [row('a'), row('b')], deletes: [], nextCursor: 'c1', hasMore: true },
        { rows: [row('c')], deletes: [], nextCursor: 'c2', hasMore: false },
      ],
    });
    await pullEntity(repo, source, 'tasks');
    expect((await repo.list('tasks')).map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
    expect(await repo.getCursor('tasks')).toBe('c2');
    expect(source.calls.tasks).toBe(2);
  });

  it('applies tombstones from a page (offline-learned delete)', async () => {
    const repo = new InMemoryRepository();
    await repo.upsert('tasks', row('gone'));
    const source = scriptedSource({
      tasks: [{ rows: [], deletes: [{ id: 'gone' }], nextCursor: 'c1', hasMore: false }],
    });
    await pullEntity(repo, source, 'tasks');
    expect(await repo.get('tasks', 'gone')).toBeNull();
  });

  it('does not loop forever when the server reports hasMore but the cursor stalls', async () => {
    const repo = new InMemoryRepository();
    const stall: PullPage = { rows: [row('a')], deletes: [], nextCursor: 'same', hasMore: true };
    const source: PullSource = { fetch: vi.fn(async () => stall) };
    await repo.setCursor('tasks', 'same'); // cursor already equals nextCursor
    await pullEntity(repo, source, 'tasks');
    expect(source.fetch).toHaveBeenCalledTimes(1); // stopped, no infinite loop
  });
});

describe('hydrate', () => {
  it('pulls every entity and reports monotonic progress to 1, then ready', async () => {
    const repo = new InMemoryRepository();
    const source = scriptedSource({
      projects: [{ rows: [row('p')], deletes: [], nextCursor: 'c', hasMore: false }],
      tasks: [{ rows: [row('t')], deletes: [], nextCursor: 'c', hasMore: false }],
    });
    const progress: number[] = [];
    await hydrate(repo, source, ['projects', 'tasks'], (p) => progress.push(p));

    expect(await repo.get('projects', 'p')).not.toBeNull();
    expect(await repo.get('tasks', 't')).not.toBeNull();
    expect(progress).toEqual([0.5, 1]);
    expect(repo.hydration()).toEqual({ ready: true, progress: 1 });
  });
});
