import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryMediaQueue } from './memoryMediaQueue';
import type { MediaStore, MediaUpload } from './contract';
import { uploadOnce, drainMedia, computeBackoffMs, type MediaTransport } from './uploader';

const T0 = '2026-08-06T00:00:00.000Z';
const at = (ms: number) => new Date(new Date(T0).getTime() + ms).toISOString();

const up = (id: string): MediaUpload => ({
  id,
  bucket: 'task-docs',
  path: `proj/task/${id}.jpg`,
  contentType: 'image/jpeg',
  size: 3,
  entity: 'tasks',
  entityId: 'task',
});

/** In-memory byte store for tests. */
function makeStore(seed: string[] = []): MediaStore & { has: (k: string) => boolean } {
  const m = new Map<string, Uint8Array>();
  for (const k of seed) m.set(k, new Uint8Array([1, 2, 3]));
  return {
    put: async (k, b) => void m.set(k, b),
    get: async (k) => m.get(k) ?? null,
    remove: async (k) => void m.delete(k),
    has: (k) => m.has(k),
  };
}

describe('computeBackoffMs', () => {
  it('doubles per attempt, capped', () => {
    expect(computeBackoffMs(0, 1000, 300_000)).toBe(1000);
    expect(computeBackoffMs(3, 1000, 300_000)).toBe(8000);
    expect(computeBackoffMs(20, 1000, 300_000)).toBe(300_000);
  });
});

describe('uploadOnce', () => {
  let q: InMemoryMediaQueue;
  beforeEach(() => {
    q = new InMemoryMediaQueue(() => T0);
  });

  it('uploads bytes, records the reference, then drops the entry + bytes', async () => {
    await q.enqueue(up('a'));
    const store = makeStore(['a']);
    const transport: MediaTransport = { upload: vi.fn(async () => {}) };
    const onUploaded = vi.fn(async () => {});

    const s = await uploadOnce(q, { now: () => T0, store, transport, onUploaded });

    expect(s).toMatchObject({ sent: 1, uploaded: 1 });
    expect(transport.upload).toHaveBeenCalledWith('task-docs', 'proj/task/a.jpg', expect.any(Uint8Array), 'image/jpeg');
    expect(onUploaded).toHaveBeenCalledOnce();
    expect(await q.get('a')).toBeNull(); // dropped
    expect(store.has('a')).toBe(false); // bytes removed
  });

  it('drops an entry whose bytes are missing (nothing to send)', async () => {
    await q.enqueue(up('a'));
    const store = makeStore([]); // no bytes for 'a'
    const transport: MediaTransport = { upload: vi.fn(async () => {}) };
    const s = await uploadOnce(q, { now: () => T0, store, transport });
    expect(transport.upload).not.toHaveBeenCalled();
    expect(await q.get('a')).toBeNull();
    expect(s.uploaded).toBe(0);
  });

  it('a transport failure backs the entry off; it retries after the window', async () => {
    await q.enqueue(up('a'));
    const store = makeStore(['a']);
    const transport: MediaTransport = { upload: vi.fn(async () => { throw new Error('offline'); }) };

    const s1 = await uploadOnce(q, { now: () => T0, store, transport });
    expect(s1.failed).toBe(1);
    expect((await q.get('a'))?.status).toBe('failed');
    expect((await q.get('a'))?.nextAttemptAt).toBe(at(1000));

    // too soon
    expect((await uploadOnce(q, { now: () => at(500), store, transport })).sent).toBe(0);
    // after backoff
    expect((await uploadOnce(q, { now: () => at(1000), store, transport })).sent).toBe(1);
    expect((await q.get('a'))?.attempts).toBe(2);
  });

  it('dead-letters after maxAttempts', async () => {
    await q.enqueue(up('a'));
    const store = makeStore(['a']);
    const transport: MediaTransport = { upload: vi.fn(async () => { throw new Error('x'); }) };
    await uploadOnce(q, { now: () => T0, store, transport, maxAttempts: 2 }); // 0→1
    const s2 = await uploadOnce(q, { now: () => at(1000), store, transport, maxAttempts: 2 }); // 1→2 dead
    expect(s2.deadLettered).toBe(1);
    expect((await q.get('a'))?.lastError).toContain('dead-lettered');
  });
});

describe('drainMedia', () => {
  it('uploads everything across passes', async () => {
    const q = new InMemoryMediaQueue(() => T0);
    for (const id of ['a', 'b', 'c', 'd']) await q.enqueue(up(id));
    const store = makeStore(['a', 'b', 'c', 'd']);
    const transport: MediaTransport = { upload: vi.fn(async () => {}) };
    const total = await drainMedia(q, { now: () => T0, store, transport, batchSize: 2 });
    expect(total.uploaded).toBe(4);
    expect(await q.pendingCount()).toBe(0);
  });
});
