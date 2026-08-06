import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryOutbox } from './memoryOutbox';
import type { OutboxMutation } from './contract';
import {
  flushOnce,
  drain,
  computeBackoffMs,
  type MutationResult,
  type MutationTransport,
} from './flusher';

const T0 = '2026-08-06T00:00:00.000Z';
const at = (ms: number) => new Date(new Date(T0).getTime() + ms).toISOString();

const mut = (id: string, extra?: Partial<OutboxMutation>): OutboxMutation => ({
  id,
  entity: 'tasks',
  op: 'upsert',
  data: { id: `row-${id}`, title: id },
  ...extra,
});

/** A transport whose reply is scripted per test; records every batch it was sent. */
class FakeTransport implements MutationTransport {
  batches: OutboxMutation[][] = [];
  constructor(private reply: (m: OutboxMutation[]) => MutationResult[] | Promise<MutationResult[]>) {}
  async send(mutations: OutboxMutation[]): Promise<MutationResult[]> {
    this.batches.push(mutations);
    return this.reply(mutations);
  }
}

describe('computeBackoffMs', () => {
  it('doubles per attempt and caps at max', () => {
    expect(computeBackoffMs(0, 1000, 300_000)).toBe(1000);
    expect(computeBackoffMs(1, 1000, 300_000)).toBe(2000);
    expect(computeBackoffMs(3, 1000, 300_000)).toBe(8000);
    expect(computeBackoffMs(20, 1000, 300_000)).toBe(300_000); // ceiling
  });
});

describe('flushOnce', () => {
  let outbox: InMemoryOutbox;
  beforeEach(() => {
    outbox = new InMemoryOutbox(() => T0);
  });

  it('applied → acked and reconciled with the server row', async () => {
    await outbox.enqueue(mut('a'));
    const reconcile = vi.fn(async () => {});
    const transport = new FakeTransport(() => [
      { id: 'a', status: 'applied', row: { id: 'row-a', updated_at: '2026-08-06T09:00:00Z', title: 'a' } },
    ]);

    const s = await flushOnce(outbox, transport, { now: () => T0, reconcile });

    expect(s).toMatchObject({ sent: 1, applied: 1 });
    expect(await outbox.size()).toBe(0); // dropped from the queue
    expect(reconcile).toHaveBeenCalledWith('tasks', { id: 'row-a', updated_at: '2026-08-06T09:00:00Z', title: 'a' });
  });

  it('duplicate → acked without reconciling (idempotent replay)', async () => {
    await outbox.enqueue(mut('a'));
    const reconcile = vi.fn(async () => {});
    const transport = new FakeTransport(() => [{ id: 'a', status: 'duplicate' }]);

    const s = await flushOnce(outbox, transport, { now: () => T0, reconcile });

    expect(s.applied).toBe(1);
    expect(await outbox.size()).toBe(0);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('conflict and forbidden park the entry (stays, excluded from future batches)', async () => {
    await outbox.enqueue(mut('a'));
    await outbox.enqueue(mut('b'));
    const transport = new FakeTransport(() => [
      { id: 'a', status: 'conflict', error: 'baseVersion mismatch' },
      { id: 'b', status: 'forbidden', error: 'module revoked' },
    ]);

    const s = await flushOnce(outbox, transport, { now: () => T0 });

    expect(s.conflicts).toBe(2);
    expect((await outbox.get('a'))?.status).toBe('conflict');
    expect((await outbox.get('b'))?.status).toBe('conflict');
    expect(await outbox.nextBatch(at(10 * 60_000), 10)).toEqual([]); // never re-sent automatically
  });

  it('transient error → backed off, then retried once the window passes', async () => {
    await outbox.enqueue(mut('a'));
    const transport = new FakeTransport((m) =>
      m.map((x) => ({ id: x.id, status: 'error' as const, error: 'db timeout' })),
    );

    const s1 = await flushOnce(outbox, transport, { now: () => T0 });
    expect(s1.failed).toBe(1);
    const failed = await outbox.get('a');
    expect(failed?.status).toBe('failed');
    expect(failed?.attempts).toBe(1);
    expect(failed?.nextAttemptAt).toBe(at(1000)); // base delay

    // Too soon: nothing sent.
    const s2 = await flushOnce(outbox, transport, { now: () => at(500) });
    expect(s2.sent).toBe(0);
    expect(transport.batches).toHaveLength(1);

    // After the window: retried, attempts climb, next window doubles.
    const s3 = await flushOnce(outbox, transport, { now: () => at(1000) });
    expect(s3.sent).toBe(1);
    expect((await outbox.get('a'))?.attempts).toBe(2);
    expect((await outbox.get('a'))?.nextAttemptAt).toBe(at(1000 + 2000));
  });

  it('whole-batch transport failure fails every entry with backoff', async () => {
    await outbox.enqueue(mut('a'));
    await outbox.enqueue(mut('b'));
    const transport = new FakeTransport(() => {
      throw new Error('offline');
    });

    const s = await flushOnce(outbox, transport, { now: () => T0 });

    expect(s).toMatchObject({ sent: 2, failed: 2 });
    expect((await outbox.get('a'))?.lastError).toBe('offline');
    expect((await outbox.get('b'))?.status).toBe('failed');
  });

  it('holds a dependent back while its dependency is not in the same batch', async () => {
    await outbox.enqueue(mut('dep'));
    await outbox.enqueue(mut('child', { dependsOn: ['dep'] }));
    // Park the dependency in backoff so it is NOT eligible this pass.
    await outbox.markFailed('dep', 'x', at(60_000));

    const sent: OutboxMutation[][] = [];
    const transport = new FakeTransport((m) => {
      sent.push(m);
      return m.map((x) => ({ id: x.id, status: 'applied' as const }));
    });

    // 'child' is eligible but its dep is owed and not in the batch → held back.
    const s = await flushOnce(outbox, transport, { now: () => T0 });
    expect(s.sent).toBe(0);
    expect(sent).toHaveLength(0);
    expect((await outbox.get('child'))?.status).toBe('pending'); // untouched, tries again later
  });

  it('ships dependency and dependent together in one batch, dependency first', async () => {
    await outbox.enqueue(mut('dep'));
    await outbox.enqueue(mut('child', { dependsOn: ['dep'] }));
    let seenOrder: string[] = [];
    const transport = new FakeTransport((m) => {
      seenOrder = m.map((x) => x.id);
      return m.map((x) => ({ id: x.id, status: 'applied' as const }));
    });

    const s = await flushOnce(outbox, transport, { now: () => T0 });
    expect(s.applied).toBe(2);
    expect(seenOrder).toEqual(['dep', 'child']); // FIFO = dependency-first
  });

  it('caps the batch at batchSize', async () => {
    for (const id of ['a', 'b', 'c']) await outbox.enqueue(mut(id));
    const transport = new FakeTransport((m) => m.map((x) => ({ id: x.id, status: 'applied' as const })));
    const s = await flushOnce(outbox, transport, { now: () => T0, batchSize: 2 });
    expect(s.sent).toBe(2);
    expect(await outbox.size()).toBe(1); // one still queued
  });

  it('dead-letters an entry once it exhausts maxAttempts', async () => {
    await outbox.enqueue(mut('a'));
    const transport = new FakeTransport((m) => m.map((x) => ({ id: x.id, status: 'error' as const })));

    await flushOnce(outbox, transport, { now: () => T0, maxAttempts: 2 }); // attempts 0→1, failed
    const s2 = await flushOnce(outbox, transport, { now: () => at(1000), maxAttempts: 2 }); // 1→2, dead-letter

    expect(s2.deadLettered).toBe(1);
    const dead = await outbox.get('a');
    expect(dead?.status).toBe('conflict');
    expect(dead?.lastError).toContain('dead-lettered');
  });
});

describe('drain', () => {
  it('flushes repeatedly until the queue is empty', async () => {
    const outbox = new InMemoryOutbox(() => T0);
    for (const id of ['a', 'b', 'c', 'd', 'e']) await outbox.enqueue(mut(id));
    const transport = new FakeTransport((m) => m.map((x) => ({ id: x.id, status: 'applied' as const })));

    const total = await drain(outbox, transport, { now: () => T0, batchSize: 2 });

    expect(total.applied).toBe(5);
    expect(await outbox.size()).toBe(0);
    expect(transport.batches.map((b) => b.length)).toEqual([2, 2, 1]); // three passes
  });

  it('stops when only backed-off / conflict entries remain', async () => {
    const outbox = new InMemoryOutbox(() => T0);
    await outbox.enqueue(mut('a'));
    const transport = new FakeTransport((m) => m.map((x) => ({ id: x.id, status: 'error' as const })));

    const total = await drain(outbox, transport, { now: () => T0 });

    expect(total.failed).toBe(1);
    expect(transport.batches).toHaveLength(1); // second pass finds nothing eligible → stops
    expect(await outbox.size()).toBe(1);
  });
});
