// SqlRepository — the Repository contract over any SQLite runtime (native / OPFS /
// sql.js), holding ALL the query logic so a runtime only supplies a SqlDriver. This
// is the persistent counterpart to InMemoryRepository: data survives app restarts.
import type { Delta, HydrationState, Repository, Row, Unsubscribe } from '../contract';
import type { SqlDriver } from './driver';
import { SCHEMA_SQL } from './schema';

const HYDRATION_KEY = 'hydration';

export class SqlRepository implements Repository {
  private listeners = new Map<string, Set<() => void>>();
  private hydrationState: HydrationState = { ready: false, progress: 0 };

  private constructor(private driver: SqlDriver) {}

  /** Create + initialise (schema + restore hydration flag). */
  static async create(driver: SqlDriver): Promise<SqlRepository> {
    for (const stmt of SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean)) {
      await driver.run(stmt);
    }
    const repo = new SqlRepository(driver);
    const meta = await driver.all<{ value: string }>('SELECT value FROM meta WHERE key = ?', [HYDRATION_KEY]);
    if (meta[0]?.value) {
      try {
        repo.hydrationState = JSON.parse(meta[0].value) as HydrationState;
      } catch {
        /* ignore corrupt meta */
      }
    }
    return repo;
  }

  private notify(entity: string): void {
    this.listeners.get(entity)?.forEach((fn) => fn());
  }

  private async upsertRow(entity: string, row: Row): Promise<void> {
    await this.driver.run(
      `INSERT INTO rows (entity, id, updated_at, deleted_at, doc) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(entity, id) DO UPDATE SET updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at, doc = excluded.doc`,
      [entity, row.id, row.updated_at, row.deleted_at ?? null, JSON.stringify(row)],
    );
  }

  async get(entity: string, id: string): Promise<Row | null> {
    const rows = await this.driver.all<{ doc: string }>(
      'SELECT doc FROM rows WHERE entity = ? AND id = ? AND deleted_at IS NULL',
      [entity, id],
    );
    return rows[0] ? (JSON.parse(rows[0].doc) as Row) : null;
  }

  async list(entity: string): Promise<Row[]> {
    const rows = await this.driver.all<{ doc: string }>(
      'SELECT doc FROM rows WHERE entity = ? AND deleted_at IS NULL ORDER BY updated_at, id',
      [entity],
    );
    return rows.map((r) => JSON.parse(r.doc) as Row);
  }

  async query(entity: string, predicate: (row: Row) => boolean): Promise<Row[]> {
    return (await this.list(entity)).filter(predicate);
  }

  async upsert(entity: string, row: Row): Promise<void> {
    await this.upsertRow(entity, row);
    this.notify(entity);
  }

  async remove(entity: string, id: string): Promise<void> {
    const cur = await this.get(entity, id);
    if (!cur) return;
    const deleted: Row = { ...cur, deleted_at: new Date().toISOString() };
    await this.driver.run('UPDATE rows SET deleted_at = ?, doc = ? WHERE entity = ? AND id = ?', [
      deleted.deleted_at,
      JSON.stringify(deleted),
      entity,
      id,
    ]);
    this.notify(entity);
  }

  async applyDelta(entity: string, delta: Delta): Promise<void> {
    for (const row of delta.upserts) await this.upsertRow(entity, row);
    for (const del of delta.deletes) {
      await this.driver.run('DELETE FROM rows WHERE entity = ? AND id = ?', [entity, del.id]);
    }
    if (delta.upserts.length || delta.deletes.length) this.notify(entity);
  }

  async getCursor(entity: string): Promise<string | null> {
    const rows = await this.driver.all<{ cursor: string | null }>(
      'SELECT cursor FROM cursors WHERE entity = ?',
      [entity],
    );
    return rows[0]?.cursor ?? null;
  }

  async setCursor(entity: string, cursor: string | null): Promise<void> {
    await this.driver.run(
      'INSERT INTO cursors (entity, cursor) VALUES (?, ?) ON CONFLICT(entity) DO UPDATE SET cursor = excluded.cursor',
      [entity, cursor],
    );
  }

  subscribe(entity: string, listener: () => void): Unsubscribe {
    let set = this.listeners.get(entity);
    if (!set) {
      set = new Set();
      this.listeners.set(entity, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  hydration(): HydrationState {
    return this.hydrationState;
  }

  setHydration(state: HydrationState): void {
    this.hydrationState = state;
    // Best-effort persist so a restart knows it was hydrated.
    void this.driver.run(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [HYDRATION_KEY, JSON.stringify(state)],
    );
  }
}
