// Offline writes — the glue between the repository (local store) and the outbox
// (send queue). This is the single entry point a screen's data layer uses to CHANGE
// data: it applies the change to the repository so the UI updates instantly, then
// records the intent in the outbox so it is shipped to the server later. AR-05 holds —
// screens call these helpers through their data hooks, never the outbox or sync engine
// directly. All effects (new id, timestamp) are injected so this is pure and testable.
import type { Repository, Row } from '../contract';
import type { Outbox, OutboxEntry } from './contract';

export interface WriteContext {
  repo: Repository;
  outbox: Outbox;
  /** Fresh idempotency key per mutation (a uuid in the app; a counter in tests). */
  newId: () => string;
  /** Current time as ISO — stamps the optimistic `updated_at`. */
  now: () => string;
}

/**
 * Create or update a row offline. The repository gets an optimistic copy stamped with
 * a local `updated_at` (so lists sort and the row shows immediately); the server owns
 * the authoritative `updated_at` and overwrites it on apply. `baseVersion` carries the
 * `updated_at` we last saw (undefined for a create) so the server can detect a
 * concurrent edit.
 */
export async function upsertRow(ctx: WriteContext, entity: string, row: Row): Promise<OutboxEntry> {
  const baseVersion = typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : undefined;
  const optimistic: Row = { ...row, updated_at: ctx.now() };
  await ctx.repo.upsert(entity, optimistic);
  return ctx.outbox.enqueue({
    id: ctx.newId(),
    entity,
    op: 'upsert',
    data: optimistic,
    baseVersion,
  });
}

/**
 * Soft-delete a row offline. The repository hides it immediately; the outbox carries a
 * `delete` mutation with the `updated_at` we last saw as `baseVersion`. Returns null if
 * the row was already gone locally (nothing to enqueue).
 */
export async function removeRow(ctx: WriteContext, entity: string, id: string): Promise<OutboxEntry | null> {
  const existing = await ctx.repo.get(entity, id);
  if (!existing) return null;
  const baseVersion = typeof existing.updated_at === 'string' ? existing.updated_at : undefined;
  await ctx.repo.remove(entity, id);
  return ctx.outbox.enqueue({
    id: ctx.newId(),
    entity,
    op: 'delete',
    data: { id },
    baseVersion,
  });
}
