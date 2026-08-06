import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../memory';
import { InMemoryOutbox } from '../outbox/memoryOutbox';
import type { OutboxEntry } from '../outbox/contract';
import { listConflicts, applyConflictResolution } from './conflicts';

const CLOCK = '2026-08-06T00:00:00.000Z';

describe('listConflicts', () => {
  it('projects only parked conflict entries into UI info', () => {
    const entries = [
      { id: 'a', entity: 'tasks', op: 'upsert', data: { id: 't1', status: 'done' }, seq: 1, status: 'pending', attempts: 0, nextAttemptAt: null, enqueuedAt: CLOCK },
      { id: 'b', entity: 'tasks', op: 'upsert', data: { id: 't2', status: 'open' }, conflictRow: { id: 't2', status: 'done', updated_at: 'v2' }, seq: 2, status: 'conflict', attempts: 1, nextAttemptAt: null, enqueuedAt: CLOCK },
    ] as OutboxEntry[];
    const out = listConflicts(entries);
    expect(out).toEqual([
      { id: 'b', entity: 'tasks', op: 'upsert', mine: { id: 't2', status: 'open' }, server: { id: 't2', status: 'done', updated_at: 'v2' } },
    ]);
  });
});

describe('applyConflictResolution', () => {
  let repo: InMemoryRepository;
  let outbox: InMemoryOutbox;
  let ids: number;
  const newId = () => `m${++ids}`;

  const parked = (): OutboxEntry =>
    ({
      id: 'c1',
      entity: 'tasks',
      op: 'upsert',
      data: { id: 't1', status: 'open', title: 'mine' },
      conflictRow: { id: 't1', status: 'done', title: 'server', updated_at: 'v2' },
      seq: 1,
      status: 'conflict',
      attempts: 1,
      nextAttemptAt: null,
      enqueuedAt: CLOCK,
    }) as OutboxEntry;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    outbox = new InMemoryOutbox(() => CLOCK);
    ids = 0;
    // Seed the outbox with the parked conflict.
    await outbox.enqueue({ id: 'c1', entity: 'tasks', op: 'upsert', data: { id: 't1', status: 'open', title: 'mine' } });
    await outbox.markConflict('c1', 'mismatch', { id: 't1', status: 'done', title: 'server', updated_at: 'v2' });
  });

  it('keep-server writes the server row locally and drops the queued write', async () => {
    await applyConflictResolution(repo, outbox, parked(), 'server', newId);
    expect((await repo.get('tasks', 't1'))?.title).toBe('server');
    expect((await repo.get('tasks', 't1'))?.status).toBe('done');
    expect(await outbox.get('c1')).toBeNull(); // discarded
    expect(await outbox.size()).toBe(0);
  });

  it('keep-mine rebases my write on the server version and re-queues it', async () => {
    await applyConflictResolution(repo, outbox, parked(), 'mine', newId);

    // Old parked entry gone; a fresh pending write exists, rebased on server's version.
    expect(await outbox.get('c1')).toBeNull();
    const all = await outbox.all();
    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe('pending');
    expect(all[0]!.baseVersion).toBe('v2'); // will apply on top of the server row next sync
    expect(all[0]!.data).toMatchObject({ status: 'open', title: 'mine' });
    // My version stays visible locally.
    expect((await repo.get('tasks', 't1'))?.title).toBe('mine');
  });
});
