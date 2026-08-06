// The FLUSHER (P3b) — the only orchestrator of the write path. It drains the outbox
// to POST /api/sync/mutations: assemble a dependency-safe batch, mark it in-flight,
// send it through an injected transport, then apply each per-mutation result back to
// the outbox (ack / conflict / retry-with-backoff). It owns NO timers and NO sockets —
// the app calls flushOnce()/drain() on connectivity or an interval — so it is pure
// orchestration and fully unit-testable with a fake transport.
import type { Row } from '../contract';
import type { Outbox, OutboxEntry, OutboxMutation } from './contract';

/** Per-mutation outcome from the server, mirroring the server's MutationResult. */
export interface MutationResult {
  id: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'blocked' | 'forbidden' | 'error';
  /** The authoritative server row (present on applied/conflict) — used to reconcile locally. */
  row?: Record<string, unknown>;
  error?: string;
}

/** The wire: sends a batch and returns one result per mutation. api-client implements it. */
export interface MutationTransport {
  send(mutations: OutboxMutation[]): Promise<MutationResult[]>;
}

export interface FlushOptions {
  /** Current time as ISO — computes retry windows and is deterministic in tests. */
  now: () => string;
  /** Max mutations per request. Default 50. */
  batchSize?: number;
  /** First retry delay in ms; doubles each attempt up to maxDelayMs. Default 1000. */
  baseDelayMs?: number;
  /** Retry backoff ceiling in ms. Default 5 min. */
  maxDelayMs?: number;
  /** After this many failed attempts an entry is dead-lettered (parked as conflict). Default 10. */
  maxAttempts?: number;
  /** Reconcile an applied server row into the local store (server owns updated_at). Optional. */
  reconcile?: (entity: string, row: Row) => Promise<void>;
}

export interface FlushSummary {
  /** How many mutations were shipped this pass. */
  sent: number;
  applied: number;
  conflicts: number;
  failed: number;
  deadLettered: number;
}

/** Exponential backoff with a ceiling: base * 2^attempts, capped at max. Pure. */
export function computeBackoffMs(attempts: number, baseMs: number, maxMs: number): number {
  return Math.min(maxMs, baseMs * 2 ** attempts);
}

const toMutation = (e: OutboxEntry): OutboxMutation => ({
  id: e.id,
  entity: e.entity,
  op: e.op,
  data: e.data,
  ...(e.baseVersion !== undefined ? { baseVersion: e.baseVersion } : {}),
  ...(e.dependsOn ? { dependsOn: e.dependsOn } : {}),
});

const EMPTY: FlushSummary = { sent: 0, applied: 0, conflicts: 0, failed: 0, deadLettered: 0 };

/**
 * One flush pass. Sends at most one batch and returns what happened. Dependency
 * HOLD-BACK: a candidate is skipped this pass if any id in its dependsOn is still owed
 * to the server (in the outbox) and is NOT already earlier in this same batch — so a
 * dependent never reaches the server ahead of its dependency.
 */
export async function flushOnce(
  outbox: Outbox,
  transport: MutationTransport,
  opts: FlushOptions,
): Promise<FlushSummary> {
  const now = opts.now();
  const batchSize = opts.batchSize ?? 50;
  const baseMs = opts.baseDelayMs ?? 1000;
  const maxMs = opts.maxDelayMs ?? 300_000;
  const maxAttempts = opts.maxAttempts ?? 10;

  const candidates = await outbox.nextBatch(now, batchSize);
  if (candidates.length === 0) return { ...EMPTY };

  // Everything still owed to the server (acked entries are already gone from the outbox).
  const owed = new Set((await outbox.all()).map((e) => e.id));
  const accepted = new Set<string>();
  const batch: OutboxEntry[] = [];
  for (const c of candidates) {
    const heldBack = (c.dependsOn ?? []).some((d) => owed.has(d) && !accepted.has(d));
    if (heldBack) continue;
    batch.push(c);
    accepted.add(c.id);
  }
  if (batch.length === 0) return { ...EMPTY };

  await outbox.markSending(batch.map((e) => e.id));

  const retryAt = (attempts: number): string =>
    new Date(new Date(now).getTime() + computeBackoffMs(attempts, baseMs, maxMs)).toISOString();

  // Whole-batch transport failure (offline, 5xx): fail every entry with backoff.
  let results: MutationResult[];
  try {
    results = await transport.send(batch.map(toMutation));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    for (const e of batch) await outbox.markFailed(e.id, message, retryAt(e.attempts));
    return { ...EMPTY, sent: batch.length, failed: batch.length };
  }

  const byId = new Map(results.map((r) => [r.id, r]));
  const summary: FlushSummary = { ...EMPTY, sent: batch.length };

  for (const e of batch) {
    const r = byId.get(e.id);
    if (!r) {
      // Server returned no verdict for this id — treat as transient and retry.
      await outbox.markFailed(e.id, 'no result returned', retryAt(e.attempts));
      summary.failed += 1;
      continue;
    }
    switch (r.status) {
      case 'applied':
      case 'duplicate':
        if (r.status === 'applied' && e.op === 'upsert' && r.row && opts.reconcile) {
          await opts.reconcile(e.entity, r.row as Row);
        }
        await outbox.markAcked(e.id);
        summary.applied += 1;
        break;
      case 'conflict':
      case 'forbidden':
        // Keep the server's current row so the UI can offer keep-server / keep-mine.
        await outbox.markConflict(e.id, r.error ?? r.status, r.row);
        summary.conflicts += 1;
        break;
      case 'blocked':
      case 'error': {
        // A failed dependency (blocked) or a transient server error: retry, unless the
        // entry has now exhausted its attempts, in which case dead-letter it for review.
        if (e.attempts + 1 >= maxAttempts) {
          await outbox.markConflict(e.id, `dead-lettered after ${e.attempts + 1} attempts: ${r.error ?? r.status}`);
          summary.deadLettered += 1;
        } else {
          await outbox.markFailed(e.id, r.error ?? r.status, retryAt(e.attempts));
          summary.failed += 1;
        }
        break;
      }
    }
  }
  return summary;
}

/**
 * Drain the outbox: flush repeatedly until a pass ships nothing (queue empty or only
 * conflicts / backed-off entries remain). Bounded by maxPasses so a pathological
 * transport can't loop forever. Use on reconnect to push everything that's due now.
 */
export async function drain(
  outbox: Outbox,
  transport: MutationTransport,
  opts: FlushOptions & { maxPasses?: number },
): Promise<FlushSummary> {
  const maxPasses = opts.maxPasses ?? 100;
  const total: FlushSummary = { sent: 0, applied: 0, conflicts: 0, failed: 0, deadLettered: 0 };
  for (let pass = 0; pass < maxPasses; pass++) {
    const s = await flushOnce(outbox, transport, opts);
    total.sent += s.sent;
    total.applied += s.applied;
    total.conflicts += s.conflicts;
    total.failed += s.failed;
    total.deadLettered += s.deadLettered;
    if (s.sent === 0) break;
  }
  return total;
}
