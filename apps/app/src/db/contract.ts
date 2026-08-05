// The REPOSITORY CONTRACT (P3a) — the only data surface screens touch (AR-05: a
// screen never imports the sync engine). Every storage runtime (in-memory now;
// native SQLite ×2 and wasm-SQLite-over-OPFS on web later) implements THIS, and the
// same contract-test suite (contractSuite.ts) proves each one. Swapping the sync
// engine (D-11) changes what's behind the contract, never the screens above it.

/** Minimum shape of a syncable row: server-owned id + updated_at, soft-delete via deleted_at. */
export interface Row {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

/** A page of server changes for one entity: upserts + tombstoned deletes. */
export interface Delta {
  upserts: Row[];
  deletes: { id: string }[];
}

export type Unsubscribe = () => void;

export interface HydrationState {
  /** True once the initial full pull has completed for every entity. */
  ready: boolean;
  /** 0..1 overall progress of initial hydration. */
  progress: number;
}

/**
 * The repository. Reads exclude soft-deleted rows; the delta path applies server
 * upserts AND tombstones so an offline-learned delete removes the local row. Local
 * writes (upsert/remove) update the store optimistically; the outbox that ships them
 * to the server is P3b — this contract is the READ path + delta application.
 */
export interface Repository {
  /** Live row by id, or null if absent or soft-deleted. */
  get(entity: string, id: string): Promise<Row | null>;
  /** All live (not soft-deleted) rows for an entity. */
  list(entity: string): Promise<Row[]>;
  /** Live rows matching a predicate. */
  query(entity: string, predicate: (row: Row) => boolean): Promise<Row[]>;

  /** Optimistic local upsert. */
  upsert(entity: string, row: Row): Promise<void>;
  /** Optimistic local soft-delete. */
  remove(entity: string, id: string): Promise<void>;

  /** Apply a server delta: upsert changed rows, apply tombstones as deletes. */
  applyDelta(entity: string, delta: Delta): Promise<void>;

  /** Per-entity pull cursor (opaque). */
  getCursor(entity: string): Promise<string | null>;
  setCursor(entity: string, cursor: string | null): Promise<void>;

  /** Reactive read: fires after any change to the entity (screens subscribe). */
  subscribe(entity: string, listener: () => void): Unsubscribe;

  hydration(): HydrationState;
  setHydration(state: HydrationState): void;
}
