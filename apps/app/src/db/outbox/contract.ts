// The OUTBOX (P3b) — the durable, ordered queue of local writes waiting to reach the
// server. P3a built the READ path (repository + delta pull); the outbox is the WRITE
// path's storage: every optimistic upsert/remove a screen makes is ALSO enqueued here
// so it survives an app kill and is shipped — in order, idempotently, with retries —
// to POST /api/sync/mutations when back online. Mirroring the repository, there is ONE
// contract with ONE shared test suite (outboxSuite = TEST LAYER 5) that every runtime
// (in-memory now; SQLite next) must satisfy, so swapping the store never changes
// behaviour and never touches screens (AR-05).

/** The two write shapes the server accepts. */
export type MutationOp = 'upsert' | 'delete';

/**
 * A pending write in the EXACT wire shape POST /api/sync/mutations expects (see the
 * server's Mutation). The flusher maps an OutboxEntry straight onto this to send.
 */
export interface OutboxMutation {
  /** Client-generated idempotency key AND the in-batch dependsOn handle. Stable across retries. */
  id: string;
  entity: string;
  op: MutationOp;
  /** Row payload for an upsert (must include the row's `id`); `{ id }` for a delete. */
  data: Record<string, unknown>;
  /** The `updated_at` the client last saw — optimistic-concurrency guard. Absent = create. */
  baseVersion?: string;
  /** Other queued mutations (by `id`) that must reach the server first. */
  dependsOn?: string[];
}

/**
 * Lifecycle of a queued write:
 * - `pending`  — waiting to be sent.
 * - `sending`  — a flush picked it up and it is in flight (won't be re-sent concurrently).
 * - `failed`   — a transient error; retried once `nextAttemptAt` has passed (backoff).
 * - `conflict` — the server rejected it on a version/permission clash; parked for
 *                resolution (a fresh enqueue will NOT silently clobber it).
 * An acked (or discarded) entry is removed from the queue entirely.
 */
export type OutboxStatus = 'pending' | 'sending' | 'failed' | 'conflict';

export interface OutboxEntry extends OutboxMutation {
  /** Monotonic enqueue order — the FIFO send order and a stable tiebreak. */
  seq: number;
  status: OutboxStatus;
  /** How many send attempts have failed so far. */
  attempts: number;
  /** Earliest ISO time a `failed` entry may be retried; null while pending/never-failed. */
  nextAttemptAt: string | null;
  /** Last transport/server error message, for surfacing + debugging. */
  lastError?: string;
  /** On a parked conflict: the server's current authoritative row (for keep-server / keep-mine). */
  conflictRow?: Record<string, unknown>;
  enqueuedAt: string;
}

/**
 * The outbox store. The FLUSHER (P3b next increment) is the only orchestrator: it
 * reads `nextBatch`, `markSending`, POSTs, then applies `markAcked`/`markFailed`/
 * `markConflict` per the server's per-mutation result. This interface is storage only —
 * no networking, no timers — so it is trivially unit-tested and swappable.
 */
export interface Outbox {
  /**
   * Queue a write. Idempotent on `id`: re-enqueuing an id that is still `pending`,
   * `sending`, or `failed` REPLACES its payload (coalesces a repeated intent), keeps
   * its queue position (`seq`), and resets it to `pending` with a fresh retry budget.
   * An id already parked in `conflict` is left untouched and returned as-is.
   */
  enqueue(mutation: OutboxMutation): Promise<OutboxEntry>;

  /** Every entry, in seq order (for inspection and a "pending changes" UI badge). */
  all(): Promise<OutboxEntry[]>;
  get(id: string): Promise<OutboxEntry | null>;
  /** Count of entries still owing the server (everything not yet acked/discarded). */
  size(): Promise<number>;

  /**
   * The next entries eligible to send, in FIFO (`seq`) order, capped at `limit`.
   * Eligible = `pending`, or `failed` whose `nextAttemptAt <= now`. Excludes `sending`
   * (already in flight) and `conflict` (blocked on resolution). Dependency HOLD-BACK —
   * not shipping a dependent while its dependency is still unacked — is the flusher's
   * job when it assembles the batch; the store only reports raw eligibility.
   */
  nextBatch(now: string, limit: number): Promise<OutboxEntry[]>;

  /** Mark entries as in flight (a flush picked them up). Unknown ids are ignored. */
  markSending(ids: string[]): Promise<void>;
  /** The server applied it (or reported a duplicate) — drop it from the queue. */
  markAcked(id: string): Promise<void>;
  /** Transient failure — bump `attempts`, record the error, schedule retry at `nextAttemptAt`. */
  markFailed(id: string, error: string, nextAttemptAt: string): Promise<void>;
  /** Server rejected on a version/permission conflict — park it, keeping the server's row. */
  markConflict(id: string, error: string, serverRow?: Record<string, unknown>): Promise<void>;
  /** Remove an entry outright (a conflict resolved by discarding, or a manual purge). */
  discard(id: string): Promise<void>;
}
