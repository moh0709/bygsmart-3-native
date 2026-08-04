// D-11 spike — the SHARED repository/sync contract.
//
// Both candidate engines (PowerSync, ElectricSQL) — and a bespoke build — must satisfy
// THIS interface. Screens/`db` depend only on it; no screen imports an engine type
// (AR-05). Measuring both candidates behind one contract is what makes "swap the sync
// engine in a week" a testable property rather than a hope. This file is engine-agnostic
// and has no dependency on any candidate.

/** Sync metadata carried on every local row (see the sync design doc §2). */
export interface SyncMeta {
  /** Client-generated stable id (UUIDv7). Primary key locally; FKs resolve on it. */
  _local_id: string;
  /** Server id once assigned; null while the row exists only offline. */
  id: string | null;
  /** Unsynced local changes pending in the outbox. */
  _dirty: boolean;
  /** Soft-delete marker (tombstone emitted on sync). */
  _deleted: boolean;
  /** Server version for optimistic concurrency (baseVersion). */
  _server_version: number | null;
  /** Last successful sync timestamp (ISO), or null. */
  _synced_at: string | null;
}

export type Row<T> = T & SyncMeta;

export interface QuerySpec<T> {
  where?: Partial<T>;
  includeDeleted?: boolean;
  orderBy?: keyof T;
  limit?: number;
}

/** The read/write surface a screen sees. Domain types only — no engine types. */
export interface Repository<T> {
  get(localId: string): Promise<Row<T> | null>;
  query(spec?: QuerySpec<T>): Promise<Row<T>[]>;
  create(input: T): Promise<Row<T>>;
  update(localId: string, patch: Partial<T>): Promise<Row<T>>;
  /** Soft delete — never a hard delete on syncable data (emits a tombstone on sync). */
  softDelete(localId: string): Promise<void>;
}

export type SyncPhase = 'idle' | 'pulling' | 'pushing' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  oldestPendingAgeMs: number | null;
  poison: number;
  mediaDepth: number;
  cursorAgeMs: number | null;
  lastError: string | null;
}

export type Unsubscribe = () => void;

/** The sync engine surface. Implemented by PowerSync / ElectricSQL / bespoke. */
export interface SyncController {
  pull(): Promise<void>;
  push(): Promise<void>;
  status(): SyncStatus;
  onStatus(cb: (s: SyncStatus) => void): Unsubscribe;
}

/** Media travels its own queue; its metadata row dependsOn the parent entity. */
export interface MediaQueue {
  enqueue(input: { localUri: string; parentLocalId: string; kind: string }): Promise<string>;
  status(): { depth: number; uploading: number; failed: number };
}

/** What a candidate must provide to be scored in the spike. */
export interface SyncEngineAdapter {
  readonly name: 'powersync' | 'electricsql' | 'bespoke';
  repository<T>(entity: string): Repository<T>;
  controller(): SyncController;
  media(): MediaQueue;
}
