import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../memory';
import { InMemoryOutbox } from './memoryOutbox';
import { upsertRow, removeRow, type WriteContext } from './writes';

const CLOCK = '2026-08-06T12:00:00.000Z';

describe('offline writes (repo + outbox glue)', () => {
  let ctx: WriteContext;
  let ids: number;

  beforeEach(() => {
    ids = 0;
    ctx = {
      repo: new InMemoryRepository(),
      outbox: new InMemoryOutbox(() => CLOCK),
      newId: () => `m${++ids}`,
      now: () => CLOCK,
    };
  });

  it('upsert applies optimistically to the repo AND queues a create mutation', async () => {
    const entry = await upsertRow(ctx, 'tasks', { id: 't1', updated_at: '', title: 'Ny opgave' });

    // Repo shows it right away, stamped with the local clock.
    const live = await ctx.repo.get('tasks', 't1');
    expect(live?.title).toBe('Ny opgave');
    expect(live?.updated_at).toBe(CLOCK);

    // Outbox holds the intent; no baseVersion => the server treats it as a create.
    expect(entry.op).toBe('upsert');
    expect(entry.baseVersion).toBeUndefined();
    expect((entry.data as { title: string }).title).toBe('Ny opgave');
    expect(await ctx.outbox.size()).toBe(1);
  });

  it('updating an existing row sends the last-seen version as baseVersion', async () => {
    await ctx.repo.upsert('tasks', { id: 't1', updated_at: '2026-08-01T00:00:00Z', title: 'gammel' });
    const entry = await upsertRow(ctx, 'tasks', {
      id: 't1',
      updated_at: '2026-08-01T00:00:00Z',
      title: 'ny',
    });
    expect(entry.baseVersion).toBe('2026-08-01T00:00:00Z'); // optimistic-concurrency guard
    expect((await ctx.repo.get('tasks', 't1'))?.title).toBe('ny');
  });

  it('remove hides the row locally and queues a delete carrying its version', async () => {
    await ctx.repo.upsert('tasks', { id: 't1', updated_at: '2026-08-01T00:00:00Z', title: 'x' });
    const entry = await removeRow(ctx, 'tasks', 't1');

    expect(await ctx.repo.get('tasks', 't1')).toBeNull(); // gone from reads
    expect(entry?.op).toBe('delete');
    expect(entry?.data).toEqual({ id: 't1' });
    expect(entry?.baseVersion).toBe('2026-08-01T00:00:00Z');
  });

  it('removing an already-absent row enqueues nothing', async () => {
    const entry = await removeRow(ctx, 'tasks', 'ghost');
    expect(entry).toBeNull();
    expect(await ctx.outbox.size()).toBe(0);
  });
});
