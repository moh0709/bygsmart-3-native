// In-memory Outbox — the reference implementation and the baseline the outbox
// contract suite (outboxSuite = TEST LAYER 5) runs against. It unblocks screen work
// and tests before the persistent SQLite outbox lands; every real runtime must satisfy
// the SAME suite, so this file defines the observable behaviour.
import type { Outbox, OutboxEntry, OutboxMutation } from './contract';

export class InMemoryOutbox implements Outbox {
  private entries = new Map<string, OutboxEntry>();
  private seqCounter = 0;

  /** `now` is injected so enqueue timestamps are deterministic in tests. */
  constructor(private now: () => string = () => new Date().toISOString()) {}

  async enqueue(mutation: OutboxMutation): Promise<OutboxEntry> {
    const existing = this.entries.get(mutation.id);
    // Never clobber a parked conflict — it is waiting on a resolution decision.
    if (existing && existing.status === 'conflict') return existing;

    const entry: OutboxEntry = {
      ...mutation,
      seq: existing?.seq ?? ++this.seqCounter, // keep queue position on re-enqueue
      status: 'pending',
      attempts: 0, // a fresh intent deserves a fresh retry budget
      nextAttemptAt: null,
      lastError: undefined,
      enqueuedAt: existing?.enqueuedAt ?? this.now(),
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  async all(): Promise<OutboxEntry[]> {
    return [...this.entries.values()].sort((a, b) => a.seq - b.seq);
  }

  async get(id: string): Promise<OutboxEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async size(): Promise<number> {
    return this.entries.size;
  }

  async nextBatch(now: string, limit: number): Promise<OutboxEntry[]> {
    return [...this.entries.values()]
      .filter(
        (e) =>
          e.status === 'pending' ||
          (e.status === 'failed' && (e.nextAttemptAt === null || e.nextAttemptAt <= now)),
      )
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit);
  }

  private patch(id: string, change: Partial<OutboxEntry>): void {
    const e = this.entries.get(id);
    if (e) this.entries.set(id, { ...e, ...change });
  }

  async markSending(ids: string[]): Promise<void> {
    for (const id of ids) this.patch(id, { status: 'sending' });
  }

  async markAcked(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async markFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    const e = this.entries.get(id);
    if (e) {
      this.entries.set(id, {
        ...e,
        status: 'failed',
        attempts: e.attempts + 1,
        lastError: error,
        nextAttemptAt,
      });
    }
  }

  async markConflict(id: string, error: string, serverRow?: Record<string, unknown>): Promise<void> {
    this.patch(id, { status: 'conflict', lastError: error, ...(serverRow ? { conflictRow: serverRow } : {}) });
  }

  async discard(id: string): Promise<void> {
    this.entries.delete(id);
  }
}
