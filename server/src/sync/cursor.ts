// Keyset cursor for the (updated_at, id) pull order. The cursor is ALWAYS the
// pair — never timestamp alone — so ties on updated_at (same-millisecond writes)
// can't drop or duplicate rows across pages. Opaque base64url(JSON) to the client.

export interface Cursor {
  updatedAt: string; // ISO timestamp
  id: string; // uuid tiebreaker
}

/** Anything strictly before any real row — the "from the beginning" cursor. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

/** Decode a cursor; returns null for absent/invalid input (start from the beginning). */
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      obj &&
      typeof obj === 'object' &&
      typeof (obj as Cursor).updatedAt === 'string' &&
      typeof (obj as Cursor).id === 'string' &&
      !Number.isNaN(Date.parse((obj as Cursor).updatedAt))
    ) {
      return { updatedAt: (obj as Cursor).updatedAt, id: (obj as Cursor).id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * PostgREST `or=` expression for the keyset predicate:
 *   updated_at > U  OR  (updated_at = U AND id > ID)
 * Passed to supabase-js `.or(...)` so the DB — under RLS — does the paging.
 */
export function keysetOrFilter(c: Cursor): string {
  return `updated_at.gt.${c.updatedAt},and(updated_at.eq.${c.updatedAt},id.gt.${c.id})`;
}

/** The `p_since` argument for the tombstone RPC (deletes strictly after the cursor). */
export function tombstoneSince(c: Cursor | null): string {
  return c ? c.updatedAt : EPOCH;
}

interface RowLike {
  id: string;
  updated_at: string;
}

/** Build the next-page cursor from the last row of a full page, else null. */
export function nextCursor(rows: RowLike[], hasMore: boolean): string | null {
  if (!hasMore || rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  return encodeCursor({ updatedAt: last.updated_at, id: last.id });
}
