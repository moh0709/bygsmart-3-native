// The local device schema (P3a 3a.1). A generic per-entity document store — one
// shape serves every syncable entity, which is what a sync engine's local store
// looks like and keeps the three runtimes (native SQLite ×2, wasm-SQLite/OPFS)
// identical. The server owns the row's `updated_at`/`deleted_at`; we mirror them as
// columns for fast cursor/soft-delete filtering and keep the full row in `doc` JSON.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rows (
  entity     TEXT NOT NULL,
  id         TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  doc        TEXT NOT NULL,
  PRIMARY KEY (entity, id)
);
CREATE INDEX IF NOT EXISTS idx_rows_entity_cursor ON rows (entity, updated_at, id);
CREATE TABLE IF NOT EXISTS cursors (
  entity TEXT PRIMARY KEY,
  cursor TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;
