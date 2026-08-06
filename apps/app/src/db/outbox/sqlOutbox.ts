// SqlOutbox — the durable Outbox over any SqlDriver (native op-sqlite/expo-sqlite,
// wasm-SQLite/OPFS on web, sql.js in tests). This is the persistent counterpart to
// InMemoryOutbox: queued writes survive an app kill, so a change made offline is still
// shipped after the process is restarted. It holds ALL the SQL; a runtime supplies only
// the two-call driver. It satisfies the SAME outbox suite (TEST LAYER 5) as the
// in-memory reference, so behaviour is identical across stores.
import type { SqlDriver } from '../sql/driver';
import type { Outbox, OutboxEntry, OutboxMutation, OutboxStatus } from './contract';
import { OUTBOX_SCHEMA_SQL, OUTBOX_ADD_COLUMNS } from './schema';

interface OutboxRow {
  id: string;
  seq: number;
  entity: string;
  op: string;
  data: string;
  base_version: string | null;
  depends_on: string | null;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  conflict_row: string | null;
  enqueued_at: string;
}

function toEntry(r: OutboxRow): OutboxEntry {
  return {
    id: r.id,
    seq: r.seq,
    entity: r.entity,
    op: r.op as OutboxMutation['op'],
    data: JSON.parse(r.data) as Record<string, unknown>,
    ...(r.base_version !== null ? { baseVersion: r.base_version } : {}),
    ...(r.depends_on !== null ? { dependsOn: JSON.parse(r.depends_on) as string[] } : {}),
    status: r.status as OutboxStatus,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    ...(r.last_error !== null ? { lastError: r.last_error } : {}),
    ...(r.conflict_row != null ? { conflictRow: JSON.parse(r.conflict_row) as Record<string, unknown> } : {}),
    enqueuedAt: r.enqueued_at,
  };
}

export class SqlOutbox implements Outbox {
  private constructor(private driver: SqlDriver, private now: () => string) {}

  /** Create + initialise (idempotent DDL). `now` is injected for deterministic tests. */
  static async create(
    driver: SqlDriver,
    now: () => string = () => new Date().toISOString(),
  ): Promise<SqlOutbox> {
    for (const stmt of OUTBOX_SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await driver.run(stmt);
    }
    // Guarded migrations for dev dbs created before a column existed.
    const cols = await driver.all<{ name: string }>('PRAGMA table_info(outbox)');
    const have = new Set(cols.map((c) => c.name));
    for (const [name, ddl] of Object.entries(OUTBOX_ADD_COLUMNS)) {
      if (!have.has(name)) await driver.run(ddl);
    }
    return new SqlOutbox(driver, now);
  }

  private async row(id: string): Promise<OutboxRow | null> {
    const rows = await this.driver.all<OutboxRow>('SELECT * FROM outbox WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async enqueue(mutation: OutboxMutation): Promise<OutboxEntry> {
    const existing = await this.row(mutation.id);
    // Never clobber a parked conflict — it is awaiting a resolution decision.
    if (existing && existing.status === 'conflict') return toEntry(existing);

    let seq = existing?.seq ?? null;
    if (seq === null) {
      const max = await this.driver.all<{ next: number }>('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM outbox');
      seq = max[0]?.next ?? 1;
    }
    const enqueuedAt = existing?.enqueued_at ?? this.now();
    const dependsOn = mutation.dependsOn ? JSON.stringify(mutation.dependsOn) : null;

    await this.driver.run(
      `INSERT INTO outbox (id, seq, entity, op, data, base_version, depends_on, status, attempts, next_attempt_at, last_error, enqueued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET
         entity = excluded.entity, op = excluded.op, data = excluded.data,
         base_version = excluded.base_version, depends_on = excluded.depends_on,
         status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL`,
      [
        mutation.id,
        seq,
        mutation.entity,
        mutation.op,
        JSON.stringify(mutation.data),
        mutation.baseVersion ?? null,
        dependsOn,
        enqueuedAt,
      ],
    );
    return toEntry((await this.row(mutation.id))!);
  }

  async all(): Promise<OutboxEntry[]> {
    const rows = await this.driver.all<OutboxRow>('SELECT * FROM outbox ORDER BY seq');
    return rows.map(toEntry);
  }

  async get(id: string): Promise<OutboxEntry | null> {
    const r = await this.row(id);
    return r ? toEntry(r) : null;
  }

  async size(): Promise<number> {
    const rows = await this.driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return rows[0]?.n ?? 0;
  }

  async nextBatch(now: string, limit: number): Promise<OutboxEntry[]> {
    const rows = await this.driver.all<OutboxRow>(
      `SELECT * FROM outbox
       WHERE status = 'pending'
          OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
       ORDER BY seq
       LIMIT ?`,
      [now, limit],
    );
    return rows.map(toEntry);
  }

  async markSending(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.driver.run("UPDATE outbox SET status = 'sending' WHERE id = ?", [id]);
    }
  }

  async markAcked(id: string): Promise<void> {
    await this.driver.run('DELETE FROM outbox WHERE id = ?', [id]);
  }

  async markFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    await this.driver.run(
      "UPDATE outbox SET status = 'failed', attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?",
      [error, nextAttemptAt, id],
    );
  }

  async markConflict(id: string, error: string, serverRow?: Record<string, unknown>): Promise<void> {
    await this.driver.run("UPDATE outbox SET status = 'conflict', last_error = ?, conflict_row = ? WHERE id = ?", [
      error,
      serverRow ? JSON.stringify(serverRow) : null,
      id,
    ]);
  }

  async discard(id: string): Promise<void> {
    await this.driver.run('DELETE FROM outbox WHERE id = ?', [id]);
  }
}
