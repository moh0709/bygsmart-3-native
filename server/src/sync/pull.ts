import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncEntity } from './entities';
import { decodeCursor, keysetOrFilter, nextCursor, tombstoneSince } from './cursor';

export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 1000;

export interface DeleteEvent {
  id: string;
  deletedAt: string;
}

export interface PullResult {
  entity: string;
  /** Upserted/changed rows since the cursor (includes still-visible soft-deleted rows). */
  rows: Record<string, unknown>[];
  /** Deletes the caller could have seen, from the adjudicated tombstone feed. */
  deletes: DeleteEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function clampLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/**
 * Pull a page of one entity for the caller. Rows come RLS-applied via PostgREST;
 * deletes come from the DEFINER tombstone RPC (called on the same user client, so
 * auth.uid() scopes it). Soft-deleted rows that are still visible are returned as
 * rows (with deleted_at) too — the client applies whichever it sees.
 */
export async function pullEntity(
  db: SupabaseClient,
  entity: SyncEntity,
  cursorRaw: string | undefined,
  limit: number,
): Promise<PullResult> {
  const cursor = decodeCursor(cursorRaw);

  let q = db.from(entity.table).select('*');
  if (cursor) q = q.or(keysetOrFilter(cursor));
  q = q.order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit + 1);

  const { data, error } = await q;
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: 400 });

  const fetched = (data ?? []) as Record<string, unknown>[];
  const hasMore = fetched.length > limit;
  const rows = hasMore ? fetched.slice(0, limit) : fetched;

  const deletes = await pullDeletes(db, entity, tombstoneSince(cursor));

  return {
    entity: entity.table,
    rows,
    deletes,
    nextCursor: nextCursor(rows as { id: string; updated_at: string }[], hasMore),
    hasMore,
  };
}

async function pullDeletes(db: SupabaseClient, entity: SyncEntity, since: string): Promise<DeleteEvent[]> {
  if (!entity.ownTombstone) return []; // derived/local entities: deletes come via their parent
  const { data, error } = await db.rpc('sync_pull_tombstones', { p_entity: entity.table, p_since: since });
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: 400 });
  return ((data ?? []) as { entity_id: string; deleted_at: string }[]).map((t) => ({
    id: t.entity_id,
    deletedAt: t.deleted_at,
  }));
}
