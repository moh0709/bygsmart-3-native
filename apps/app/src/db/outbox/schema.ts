// The local OUTBOX table (P3b). Lives in the same device database as the row store so
// a single durable file holds both what we've synced (rows/cursors) and what we still
// owe the server (outbox). One generic shape serves every entity — the payload is JSON
// in `data`, exactly as it will be POSTed — so the persistent outbox is identical
// across the three SQLite runtimes (native ×2, wasm/OPFS). Idempotent DDL: safe to run
// on every open and safe to share a database with the row-store schema.
export const OUTBOX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS outbox (
  id              TEXT PRIMARY KEY,
  seq             INTEGER NOT NULL,
  entity          TEXT NOT NULL,
  op              TEXT NOT NULL,
  data            TEXT NOT NULL,
  base_version    TEXT,
  depends_on      TEXT,
  status          TEXT NOT NULL,
  attempts        INTEGER NOT NULL,
  next_attempt_at TEXT,
  last_error      TEXT,
  conflict_row    TEXT,
  enqueued_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_seq ON outbox (seq);
`;

/** Column name → DDL for guarded migrations of an existing outbox table (dev dbs
 * created before a column existed). Applied only when PRAGMA table_info lacks it. */
export const OUTBOX_ADD_COLUMNS: Record<string, string> = {
  conflict_row: 'ALTER TABLE outbox ADD COLUMN conflict_row TEXT',
};
