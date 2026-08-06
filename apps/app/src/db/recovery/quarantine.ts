// Corruption quarantine-and-rehydrate (P3a 3a.1). A local store can go bad — a
// truncated OPFS file, a failed decrypt, an on-disk SQLite corruption. The app must
// never wedge on it: move the bad store aside (kept for diagnostics, not deleted),
// start a fresh empty store, and repull from the server. The steps are injected so
// this orchestration is pure and unit-testable; the runtime wires real open/quarantine/
// fresh/rehydrate implementations (OPFS rename, secure-store key reset, delta puller).
export interface RecoveryHooks<T> {
  /** Open the existing store; throws/rejects if it is unreadable or corrupt. */
  open(): Promise<T>;
  /** Move the bad store aside (rename with a timestamp), keeping it for diagnostics. */
  quarantine(): Promise<void>;
  /** Create a new empty store. */
  fresh(): Promise<T>;
  /** Repull from the server into the fresh store. */
  rehydrate(store: T): Promise<void>;
}

export interface RecoveryResult<T> {
  store: T;
  /** True when the existing store was corrupt and we quarantined + rehydrated. */
  recovered: boolean;
}

/**
 * Open the local store, or recover from corruption. On a clean open, returns it
 * untouched. On failure, quarantines the bad store, creates a fresh one and rehydrates.
 */
export async function openOrRecover<T>(hooks: RecoveryHooks<T>): Promise<RecoveryResult<T>> {
  try {
    const store = await hooks.open();
    return { store, recovered: false };
  } catch {
    await hooks.quarantine();
    const store = await hooks.fresh();
    await hooks.rehydrate(store);
    return { store, recovered: true };
  }
}
