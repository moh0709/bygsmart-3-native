// D-11 spike — single-writer election across browser tabs (plan §3.4 R6, PRD S-14).
// The Web Locks API: the tab holding an exclusive lock for the DB name is the leader;
// other tabs read through it. The lock releases automatically when the tab closes, so a
// new leader is elected without a heartbeat. Browser-only — exercised in scenario R6 on a
// real browser; not unit-tested (needs navigator.locks).

export interface WriterElection {
  isLeader(): boolean;
  onChange(cb: (isLeader: boolean) => void): () => void;
  /** Release leadership (e.g. on teardown). */
  release(): void;
}

export function electSingleWriter(dbName = 'bygsmart-db-writer'): WriterElection {
  let leader = false;
  const listeners = new Set<(v: boolean) => void>();
  const notify = () => listeners.forEach((cb) => cb(leader));

  const g = globalThis as unknown as {
    navigator?: { locks?: { request?: (name: string, opts: unknown, cb: () => Promise<void>) => Promise<void> } };
  };
  const locks = g.navigator?.locks;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

  if (typeof locks?.request === 'function') {
    // Acquire an exclusive lock and hold it for the tab's lifetime. Resolving the held
    // promise would release leadership, so we keep it pending until release()/teardown.
    void locks
      .request(dbName, { mode: 'exclusive', signal: controller?.signal }, () => {
        leader = true;
        notify();
        return new Promise<void>(() => {
          /* held until the tab closes or release() aborts the request */
        });
      })
      .catch(() => {
        /* aborted (release) or the API rejected — remain a follower */
      });
  } else {
    // No Web Locks (very old browser): single-tab assumption; this tab is the writer.
    leader = true;
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
