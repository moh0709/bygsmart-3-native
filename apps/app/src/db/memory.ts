// In-memory Repository — the reference implementation. It is the baseline the
// contract-test suite runs against, unblocks screen work (P5-A) before the native
// SQLite / OPFS runtimes land, and is the fast store for tests and SSR. Every real
// runtime must satisfy the SAME suite, so this defines the observable behaviour.
import type { Delta, HydrationState, Repository, Row, Unsubscribe } from './contract';

function isLive(row: Row): boolean {
  return !row.deleted_at;
}

export class InMemoryRepository implements Repository {
  private tables = new Map<string, Map<string, Row>>();
  private cursors = new Map<string, string | null>();
  private listeners = new Map<string, Set<() => void>>();
  private hydrationState: HydrationState = { ready: false, progress: 0 };

  private table(entity: string): Map<string, Row> {
    let t = this.tables.get(entity);
    if (!t) {
      t = new Map();
      this.tables.set(entity, t);
    }
    return t;
  }

  private notify(entity: string): void {
    this.listeners.get(entity)?.forEach((fn) => fn());
  }

  async get(entity: string, id: string): Promise<Row | null> {
    const row = this.table(entity).get(id);
    return row && isLive(row) ? row : null;
  }

  async list(entity: string): Promise<Row[]> {
    return [...this.table(entity).values()].filter(isLive);
  }

  async query(entity: string, predicate: (row: Row) => boolean): Promise<Row[]> {
    return (await this.list(entity)).filter(predicate);
  }

  async upsert(entity: string, row: Row): Promise<void> {
    this.table(entity).set(row.id, row);
    this.notify(entity);
  }

  async remove(entity: string, id: string): Promise<void> {
    const t = this.table(entity);
    const row = t.get(id);
    if (row) {
      t.set(id, { ...row, deleted_at: new Date().toISOString() });
      this.notify(entity);
    }
  }

  async applyDelta(entity: string, delta: Delta): Promise<void> {
    const t = this.table(entity);
    for (const row of delta.upserts) t.set(row.id, row);
    for (const del of delta.deletes) {
      const existing = t.get(del.id);
      // Tombstone: drop the row so reads no longer return it.
      if (existing) t.delete(del.id);
    }
    if (delta.upserts.length || delta.deletes.length) this.notify(entity);
  }

  async getCursor(entity: string): Promise<string | null> {
    return this.cursors.get(entity) ?? null;
  }

  async setCursor(entity: string, cursor: string | null): Promise<void> {
    this.cursors.set(entity, cursor);
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
  }
}
