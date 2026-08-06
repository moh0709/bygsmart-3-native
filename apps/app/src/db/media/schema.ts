// The local MEDIA queue table (P3b) — metadata for pending uploads. Bytes live in the
// platform byte store (FS/OPFS), keyed by `id`; this table just tracks what to ship and
// where. Idempotent DDL, shares the device database with the row store + outbox.
export const MEDIA_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS media_queue (
  id              TEXT PRIMARY KEY,
  seq             INTEGER NOT NULL,
  bucket          TEXT NOT NULL,
  path            TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size            INTEGER NOT NULL,
  entity          TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  status          TEXT NOT NULL,
  attempts        INTEGER NOT NULL,
  next_attempt_at TEXT,
  last_error      TEXT,
  enqueued_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_seq ON media_queue (seq);
`;
