// Conflict resolution (P3b residue). When the server rejects a queued write because the
// row moved under it (baseVersion mismatch) or a module was revoked, the outbox parks
// the entry as `conflict` with the server's current row. These pure helpers turn parked
// entries into something the UI can show and resolve two ways:
//   • keep-server → drop my write and take the server's row locally.
//   • keep-mine   → rebase my write on the server's version and re-queue it.
import type { Repository, Row } from '../contract';
import type { Outbox, OutboxEntry } from '../outbox/contract';

export type ConflictChoice = 'server' | 'mine';

export interface ConflictInfo {
  /** Outbox entry id (the idempotency key of the losing write). */
  id: string;
  entity: string;
  op: OutboxEntry['op'];
  /** The change I tried to make. */
  mine: Record<string, unknown>;
  /** The server's current authoritative row (null if the server returned none). */
  server: Record<string, unknown> | null;
}

/** Project parked conflict entries into UI-facing info. */
export function listConflicts(entries: OutboxEntry[]): ConflictInfo[] {
  return entries
    .filter((e) => e.status === 'conflict')
    .map((e) => ({ id: e.id, entity: e.entity, op: e.op, mine: e.data, server: e.conflictRow ?? null }));
}

/**
 * Apply a resolution for one parked entry.
 * - `server`: write the server row into the local store and discard my queued write.
 * - `mine`: discard the parked entry and re-queue my change with `baseVersion` set to the
 *   server's current version, so the next sync applies it on top instead of conflicting;
 *   keep my version visible locally in the meantime.
 */
export async function applyConflictResolution(
  repo: Repository,
  outbox: Outbox,
  entry: OutboxEntry,
  choice: ConflictChoice,
  newId: () => string,
): Promise<void> {
  if (choice === 'server') {
    if (entry.conflictRow) {
      await repo.applyDelta(entry.entity, { upserts: [entry.conflictRow as Row], deletes: [] });
    }
    await outbox.discard(entry.id);
    return;
  }

  // keep-mine: rebase on the server's version and re-queue.
  const serverVersion = typeof entry.conflictRow?.updated_at === 'string' ? entry.conflictRow.updated_at : undefined;
  await outbox.discard(entry.id);
  await outbox.enqueue({
    id: newId(),
    entity: entry.entity,
    op: entry.op,
    data: entry.data,
    ...(serverVersion ? { baseVersion: serverVersion } : {}),
  });
  if (entry.op === 'upsert') await repo.upsert(entry.entity, entry.data as Row);
}
