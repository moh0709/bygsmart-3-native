// In-memory MediaQueue — the reference implementation + the baseline the media suite
// runs against. Same shape as the outbox's in-memory store.
import type { MediaEntry, MediaQueue, MediaUpload } from './contract';

export class InMemoryMediaQueue implements MediaQueue {
  private entries = new Map<string, MediaEntry>();
  private seq = 0;

  constructor(private now: () => string = () => new Date().toISOString()) {}

  async enqueue(upload: MediaUpload): Promise<MediaEntry> {
    const existing = this.entries.get(upload.id);
    const entry: MediaEntry = {
      ...upload,
      seq: existing?.seq ?? ++this.seq,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      lastError: undefined,
      enqueuedAt: existing?.enqueuedAt ?? this.now(),
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  async all(): Promise<MediaEntry[]> {
    return [...this.entries.values()].sort((a, b) => a.seq - b.seq);
  }

  async get(id: string): Promise<MediaEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async pendingCount(): Promise<number> {
    return this.entries.size;
  }

  async nextBatch(now: string, limit: number): Promise<MediaEntry[]> {
    return [...this.entries.values()]
      .filter(
        (e) =>
          e.status === 'pending' ||
          (e.status === 'failed' && (e.nextAttemptAt === null || e.nextAttemptAt <= now)),
      )
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit);
  }

  async markUploading(ids: string[]): Promise<void> {
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) this.entries.set(id, { ...e, status: 'uploading' });
    }
  }

  async markDone(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async markFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    const e = this.entries.get(id);
    if (e) this.entries.set(id, { ...e, status: 'failed', attempts: e.attempts + 1, lastError: error, nextAttemptAt });
  }
}
