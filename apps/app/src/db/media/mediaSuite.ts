// TEST LAYER (media) — the media-queue contract suite. Every MediaQueue runtime
// (in-memory now; SQLite next) must satisfy it. Time is passed in explicitly so the
// spec is deterministic.
import { describe, it, expect, beforeEach } from 'vitest';
import type { MediaQueue, MediaUpload } from './contract';

const T0 = '2026-08-06T00:00:00.000Z';
const T1 = '2026-08-06T00:00:10.000Z';

const up = (id: string, extra?: Partial<MediaUpload>): MediaUpload => ({
  id,
  bucket: 'task-docs',
  path: `proj/task/${id}.jpg`,
  contentType: 'image/jpeg',
  size: 100,
  entity: 'tasks',
  entityId: 'task',
  ...extra,
});

export function runMediaQueueContract(name: string, make: () => MediaQueue | Promise<MediaQueue>): void {
  describe(`MediaQueue contract — ${name}`, () => {
    let q: MediaQueue;
    beforeEach(async () => {
      q = await make();
    });

    it('enqueue stores a pending entry; get/all/pendingCount reflect it', async () => {
      await q.enqueue(up('a'));
      expect((await q.get('a'))?.status).toBe('pending');
      expect((await q.get('a'))?.path).toBe('proj/task/a.jpg');
      expect(await q.pendingCount()).toBe(1);
      expect((await q.all()).map((e) => e.id)).toEqual(['a']);
    });

    it('nextBatch returns FIFO order, capped', async () => {
      for (const id of ['a', 'b', 'c']) await q.enqueue(up(id));
      expect((await q.nextBatch(T0, 2)).map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('markUploading removes an entry from the eligible batch', async () => {
      await q.enqueue(up('a'));
      await q.enqueue(up('b'));
      await q.markUploading(['a']);
      expect((await q.nextBatch(T0, 10)).map((e) => e.id)).toEqual(['b']);
      expect((await q.get('a'))?.status).toBe('uploading');
    });

    it('markDone drops the entry', async () => {
      await q.enqueue(up('a'));
      await q.markDone('a');
      expect(await q.get('a')).toBeNull();
      expect(await q.pendingCount()).toBe(0);
    });

    it('markFailed backs off, then becomes eligible again', async () => {
      await q.enqueue(up('a'));
      await q.markFailed('a', 'network', T1);
      const failed = await q.get('a');
      expect(failed?.status).toBe('failed');
      expect(failed?.attempts).toBe(1);
      expect(await q.nextBatch(T0, 10)).toEqual([]);
      expect((await q.nextBatch(T1, 10)).map((e) => e.id)).toEqual(['a']);
    });
  });
}
