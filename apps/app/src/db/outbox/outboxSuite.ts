// TEST LAYER 5 — the outbox contract suite. A single behavioural spec every outbox
// runtime must satisfy; call runOutboxContract(name, factory) from a runtime's test
// file (in-memory now; persistent SQLite next runs THIS same suite). Time is passed in
// explicitly (nextBatch/markFailed take ISO strings) so the spec is fully deterministic
// without mocking a clock.
import { describe, it, expect, beforeEach } from 'vitest';
import type { Outbox, OutboxMutation } from './contract';

const T0 = '2026-08-06T00:00:00.000Z';
const T1 = '2026-08-06T00:00:10.000Z'; // 10s later

const mut = (id: string, extra?: Partial<OutboxMutation>): OutboxMutation => ({
  id,
  entity: 'tasks',
  op: 'upsert',
  data: { id: `row-${id}`, title: id },
  ...extra,
});

export function runOutboxContract(name: string, make: () => Outbox | Promise<Outbox>): void {
  describe(`Outbox contract — ${name}`, () => {
    let ob: Outbox;
    beforeEach(async () => {
      ob = await make();
    });

    it('enqueue stores a pending entry; get/all/size reflect it', async () => {
      await ob.enqueue(mut('a'));
      const got = await ob.get('a');
      expect(got?.status).toBe('pending');
      expect(got?.data).toEqual({ id: 'row-a', title: 'a' });
      expect(await ob.size()).toBe(1);
      expect((await ob.all()).map((e) => e.id)).toEqual(['a']);
      expect(await ob.get('missing')).toBeNull();
    });

    it('preserves FIFO enqueue order across all() and nextBatch()', async () => {
      await ob.enqueue(mut('a'));
      await ob.enqueue(mut('b'));
      await ob.enqueue(mut('c'));
      expect((await ob.all()).map((e) => e.id)).toEqual(['a', 'b', 'c']);
      expect((await ob.nextBatch(T0, 10)).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    it('nextBatch caps at the requested limit', async () => {
      for (const id of ['a', 'b', 'c', 'd']) await ob.enqueue(mut(id));
      expect((await ob.nextBatch(T0, 2)).map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('re-enqueuing a pending id replaces its payload but keeps its queue position', async () => {
      await ob.enqueue(mut('a'));
      await ob.enqueue(mut('b'));
      const firstSeq = (await ob.get('a'))!.seq;
      await ob.enqueue(mut('a', { data: { id: 'row-a', title: 'updated' } }));
      const again = await ob.get('a');
      expect(again!.seq).toBe(firstSeq); // did not jump to the back
      expect(again!.data).toEqual({ id: 'row-a', title: 'updated' });
      expect(await ob.size()).toBe(2); // coalesced, not duplicated
      expect((await ob.all()).map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('markSending removes an entry from the eligible batch (no concurrent resend)', async () => {
      await ob.enqueue(mut('a'));
      await ob.enqueue(mut('b'));
      await ob.markSending(['a']);
      expect((await ob.nextBatch(T0, 10)).map((e) => e.id)).toEqual(['b']);
      expect((await ob.get('a'))?.status).toBe('sending');
      expect(await ob.size()).toBe(2); // still owed to the server until acked
    });

    it('markAcked drops the entry from the queue', async () => {
      await ob.enqueue(mut('a'));
      await ob.markAcked('a');
      expect(await ob.get('a')).toBeNull();
      expect(await ob.size()).toBe(0);
      expect(await ob.nextBatch(T0, 10)).toEqual([]);
    });

    it('markFailed backs off: not eligible until nextAttemptAt, then eligible again', async () => {
      await ob.enqueue(mut('a'));
      await ob.markFailed('a', 'network down', T1);
      const failed = await ob.get('a');
      expect(failed?.status).toBe('failed');
      expect(failed?.attempts).toBe(1);
      expect(failed?.lastError).toBe('network down');
      // Before the backoff window: not eligible.
      expect(await ob.nextBatch(T0, 10)).toEqual([]);
      // At/after nextAttemptAt: eligible again.
      expect((await ob.nextBatch(T1, 10)).map((e) => e.id)).toEqual(['a']);
    });

    it('markConflict parks the entry with the server row: excluded from batches and safe from clobber', async () => {
      await ob.enqueue(mut('a'));
      await ob.markConflict('a', 'baseVersion mismatch', { id: 'row-a', title: 'server wins', updated_at: 'v2' });
      const parked = await ob.get('a');
      expect(parked?.status).toBe('conflict');
      expect(parked?.conflictRow).toEqual({ id: 'row-a', title: 'server wins', updated_at: 'v2' });
      expect(await ob.nextBatch(T1, 10)).toEqual([]);
      // A later enqueue of the same id must NOT reset a parked conflict.
      await ob.enqueue(mut('a', { data: { id: 'row-a', title: 'late' } }));
      const still = await ob.get('a');
      expect(still?.status).toBe('conflict');
      expect(still?.data).toEqual({ id: 'row-a', title: 'a' }); // original payload kept
    });

    it('discard removes an entry outright', async () => {
      await ob.enqueue(mut('a'));
      await ob.markConflict('a', 'x');
      await ob.discard('a');
      expect(await ob.get('a')).toBeNull();
      expect(await ob.size()).toBe(0);
    });
  });
}
