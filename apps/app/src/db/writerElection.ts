// Single-writer election across browser tabs (P3a 3a.3, PRD S-14). The tab holding
// the exclusive Web Lock for the DB name is the leader/writer; other tabs are
// followers (readers) — this stops two tabs writing the OPFS database at once and
// corrupting it. The lock releases automatically when a tab closes, so a new leader
// is elected with no heartbeat. On native there is one process → it is always leader.
// The locks API is injectable so the election logic is unit-testable.

export interface WriterElection {
  isLeader(): boolean;
  onChange(cb: (isLeader: boolean) => void): () => void;
  release(): void;
}

export interface LocksApi {
  request(
    name: string,
    opts: { mode: 'exclusive' | 'shared'; signal?: AbortSignal },
    cb: () => Promise<void>,
  ): Promise<void>;
}

function ambientLocks(): LocksApi | null {
  const nav = (globalThis as { navigator?: { locks?: LocksApi } }).navigator;
  return nav?.locks && typeof nav.locks.request === 'function' ? nav.locks : null;
}

/**
 * Elect a single writer for `dbName`. Pass `locks` to inject (tests); defaults to
 * navigator.locks. Without a locks API (very old browser / native single process)
 * this tab is the leader.
 */
export function electSingleWriter(dbName = 'bygsmart-db-writer', locks: LocksApi | null = ambientLocks()): WriterElection {
  let leader = false;
  const listeners = new Set<(v: boolean) => void>();
  const notify = () => listeners.forEach((cb) => cb(leader));
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

  if (locks) {
    // Hold the exclusive lock for the tab's lifetime — the held callback promise
    // stays pending (resolving it would release leadership).
    void locks
      .request(dbName, { mode: 'exclusive', signal: controller?.signal }, () => {
        leader = true;
        notify();
        return new Promise<void>(() => {
          /* held until the tab closes or release() aborts */
        });
      })
      .catch(() => {
        /* aborted (release) or rejected — stay a follower */
      });
  } else {
    leader = true; // single-process / no Web Locks: this is the writer
  }

  return {
    isLeader: () => leader,
    onChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    release: () => {
      controller?.abort();
      leader = false;
      notify();
    },
  };
}
