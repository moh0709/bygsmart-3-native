// TEST LAYER 4 — the repository contract suite. A single behavioural spec every
// storage runtime must satisfy; call runRepositoryContract(name, factory) from a
// runtime's test file (in-memory now; native SQLite / OPFS later all run THIS).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository, Row } from './contract';

const row = (id: string, updated: string, extra?: Record<string, unknown>): Row => ({
  id,
  updated_at: updated,
  ...extra,
});

export function runRepositoryContract(name: string, make: () => Repository | Promise<Repository>): void {
  describe(`Repository contract — ${name}`, () => {
    let repo: Repository;
    beforeEach(async () => {
      repo = await make();
    });

    it('upsert then get returns the row; missing id is null', async () => {
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z', { title: 'A' }));
      expect((await repo.get('tasks', 't1'))?.title).toBe('A');
      expect(await repo.get('tasks', 'nope')).toBeNull();
    });

    it('get/list/query exclude soft-deleted rows', async () => {
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z'));
      await repo.upsert('tasks', row('t2', '2026-01-01T00:00:00Z', { deleted_at: '2026-01-02T00:00:00Z' }));
      expect(await repo.get('tasks', 't2')).toBeNull();
      expect((await repo.list('tasks')).map((r) => r.id)).toEqual(['t1']);
      expect(await repo.query('tasks', () => true)).toHaveLength(1);
    });

    it('remove soft-deletes an existing live row', async () => {
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z'));
      await repo.remove('tasks', 't1');
      expect(await repo.get('tasks', 't1')).toBeNull();
      expect(await repo.list('tasks')).toHaveLength(0);
    });

    it('query filters live rows by predicate', async () => {
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z', { status: 'open' }));
      await repo.upsert('tasks', row('t2', '2026-01-01T00:00:00Z', { status: 'done' }));
      const open = await repo.query('tasks', (r) => r.status === 'open');
      expect(open.map((r) => r.id)).toEqual(['t1']);
    });

    it('applyDelta upserts changed rows and applies tombstones as deletes', async () => {
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z', { title: 'old' }));
      await repo.applyDelta('tasks', {
        upserts: [row('t1', '2026-01-03T00:00:00Z', { title: 'new' }), row('t2', '2026-01-03T00:00:00Z')],
        deletes: [],
      });
      expect((await repo.get('tasks', 't1'))?.title).toBe('new');
      expect(await repo.get('tasks', 't2')).not.toBeNull();

      await repo.applyDelta('tasks', { upserts: [], deletes: [{ id: 't1' }] });
      expect(await repo.get('tasks', 't1')).toBeNull(); // learned an offline delete
    });

    it('cursor round-trips per entity', async () => {
      expect(await repo.getCursor('tasks')).toBeNull();
      await repo.setCursor('tasks', 'cur-1');
      expect(await repo.getCursor('tasks')).toBe('cur-1');
      expect(await repo.getCursor('projects')).toBeNull(); // isolated per entity
    });

    it('subscribe fires on change; unsubscribe stops it', async () => {
      const spy = vi.fn();
      const off = repo.subscribe('tasks', spy);
      await repo.upsert('tasks', row('t1', '2026-01-01T00:00:00Z'));
      await repo.applyDelta('tasks', { upserts: [row('t2', '2026-01-01T00:00:00Z')], deletes: [] });
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
      off();
      const before = spy.mock.calls.length;
      await repo.upsert('tasks', row('t3', '2026-01-01T00:00:00Z'));
      expect(spy.mock.calls.length).toBe(before);
    });

    it('hydration state round-trips', async () => {
      expect(repo.hydration().ready).toBe(false);
      repo.setHydration({ ready: true, progress: 1 });
      expect(repo.hydration()).toEqual({ ready: true, progress: 1 });
    });
  });
}
