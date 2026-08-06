// SqlMediaQueue — the durable MediaQueue over any SqlDriver, so a photo queued offline
// survives an app kill. Holds all SQL; satisfies the same media suite as the in-memory
// reference. Mirrors SqlOutbox.
import type { SqlDriver } from '../sql/driver';
import type { MediaEntry, MediaQueue, MediaStatus, MediaUpload } from './contract';
import { MEDIA_SCHEMA_SQL } from './schema';

interface Row {
  id: string;
  seq: number;
  bucket: string;
  path: string;
  content_type: string;
  size: number;
  entity: string;
  entity_id: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  enqueued_at: string;
}

const toEntry = (r: Row): MediaEntry => ({
  id: r.id,
  seq: r.seq,
  bucket: r.bucket,
  path: r.path,
  contentType: r.content_type,
  size: r.size,
  entity: r.entity,
  entityId: r.entity_id,
  status: r.status as MediaStatus,
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  ...(r.last_error !== null ? { lastError: r.last_error } : {}),
  enqueuedAt: r.enqueued_at,
});

export class SqlMediaQueue implements MediaQueue {
  private constructor(private driver: SqlDriver, private now: () => string) {}

  static async create(driver: SqlDriver, now: () => string = () => new Date().toISOString()): Promise<SqlMediaQueue> {
    for (const stmt of MEDIA_SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await driver.run(stmt);
    }
    return new SqlMediaQueue(driver, now);
  }

  private async row(id: string): Promise<Row | null> {
    const rows = await this.driver.all<Row>('SELECT * FROM media_queue WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async enqueue(u: MediaUpload): Promise<MediaEntry> {
    const existing = await this.row(u.id);
    let seq = existing?.seq ?? null;
    if (seq === null) {
      const max = await this.driver.all<{ next: number }>('SELECT COALESCE(MAX(seq),0)+1 AS next FROM media_queue');
      seq = max[0]?.next ?? 1;
    }
    await this.driver.run(
      `INSERT INTO media_queue (id, seq, bucket, path, content_type, size, entity, entity_id, status, attempts, next_attempt_at, last_error, enqueued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET bucket=excluded.bucket, path=excluded.path, content_type=excluded.content_type,
         size=excluded.size, entity=excluded.entity, entity_id=excluded.entity_id,
         status='pending', attempts=0, next_attempt_at=NULL, last_error=NULL`,
      [u.id, seq, u.bucket, u.path, u.contentType, u.size, u.entity, u.entityId, existing?.enqueued_at ?? this.now()],
    );
    return toEntry((await this.row(u.id))!);
  }

  async all(): Promise<MediaEntry[]> {
    return (await this.driver.all<Row>('SELECT * FROM media_queue ORDER BY seq')).map(toEntry);
  }

  async get(id: string): Promise<MediaEntry | null> {
    const r = await this.row(id);
    return r ? toEntry(r) : null;
  }

  async pendingCount(): Promise<number> {
    const rows = await this.driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM media_queue');
    return rows[0]?.n ?? 0;
  }

  async nextBatch(now: string, limit: number): Promise<MediaEntry[]> {
    const rows = await this.driver.all<Row>(
      `SELECT * FROM media_queue
       WHERE status='pending' OR (status='failed' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
       ORDER BY seq LIMIT ?`,
      [now, limit],
    );
    return rows.map(toEntry);
  }

  async markUploading(ids: string[]): Promise<void> {
    for (const id of ids) await this.driver.run("UPDATE media_queue SET status='uploading' WHERE id = ?", [id]);
  }

  async markDone(id: string): Promise<void> {
    await this.driver.run('DELETE FROM media_queue WHERE id = ?', [id]);
  }

  async markFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    await this.driver.run(
      "UPDATE media_queue SET status='failed', attempts=attempts+1, last_error=?, next_attempt_at=? WHERE id = ?",
      [error, nextAttemptAt, id],
    );
  }
}
