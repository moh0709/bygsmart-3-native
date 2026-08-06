// RepositoryProvider — opens the local database once, hydrates it, and (when the
// backend is configured) runs the sync loop: initial real pull, then flush the outbox
// to the server + re-pull on a slow interval and on demand. Screens NEVER open the db
// or touch the sync engine (AR-05); they read through the hooks in ./hooks, write
// through useWrite, and observe sync via useData().sync. Mounted once in _layout.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HydrationState, Repository } from '../contract';
import type { Outbox } from '../outbox/contract';
import { hydrate, pullEntity, type PullSource } from '../puller';
import { drain, type MutationTransport } from '../outbox/flusher';
import { createHttpMutationTransport } from '../outbox/httpTransport';
import { createHttpPullSource } from './httpPullSource';
import { openDatabase } from './open';
import { makeSeedSource, SEED_ENTITIES } from './seed';
import { readSyncConfig, SYNC_ENTITIES } from './config';

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error';

export interface SyncState {
  /** 'offline' = no backend configured (local-only); otherwise the loop's state. */
  status: SyncStatus;
  /** Writes still queued for the server. */
  pending: number;
  lastError?: string;
}

export interface DataContextValue {
  repo: Repository | null;
  outbox: Outbox | null;
  hydration: HydrationState;
  /** Runtime label (dev diagnostics). */
  label: string;
  /** Authenticated user id when a backend is configured, else null (stamps owner_id). */
  userId: string | null;
  sync: SyncState;
  /** Flush the outbox to the server and re-pull now. No-op offline. */
  syncNow: () => void;
}

const DataContext = createContext<DataContextValue>({
  repo: null,
  outbox: null,
  hydration: { ready: false, progress: 0 },
  label: '',
  userId: null,
  sync: { status: 'offline', pending: 0 },
  syncNow: () => {},
});

export function useData(): DataContextValue {
  return useContext(DataContext);
}

export function RepositoryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const [label, setLabel] = useState('');
  const [hydration, setHydration] = useState<HydrationState>({ ready: false, progress: 0 });
  const [sync, setSync] = useState<SyncState>({ status: 'offline', pending: 0 });
  const started = useRef(false);

  const config = useRef(readSyncConfig()).current;
  const userId = config?.userId ?? null;

  // Stable engine refs so syncNow and the interval share one source/transport.
  const engine = useRef<{ repo: Repository; outbox: Outbox; source: PullSource; transport: MutationTransport } | null>(null);

  const runSync = useCallback(async () => {
    const e = engine.current;
    if (!e) return;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      // Push local writes first, then pull server truth (so our own writes come back
      // authoritative), applying upserts into the store on the way in.
      await drain(e.outbox, e.transport, {
        now: () => new Date().toISOString(),
        reconcile: async (entity, row) => e.repo.applyDelta(entity, { upserts: [row], deletes: [] }),
      });
      for (const entity of SYNC_ENTITIES) await pullEntity(e.repo, e.source, entity);
      setSync({ status: 'idle', pending: await e.outbox.size() });
    } catch (err) {
      setSync((s) => ({ ...s, status: 'error', lastError: err instanceof Error ? err.message : String(err) }));
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      // Backend mode uses a separate database so it never inherits the offline seed's
      // fake ids/cursors, which would collide with the real server's keyset cursor.
      const opened = await openDatabase(config ? 'bygsmart-live' : 'bygsmart-app');
      if (!alive) return;
      setRepo(opened.repo);
      setOutbox(opened.outbox);
      setLabel(opened.label);

      const source: PullSource = config
        ? createHttpPullSource({ baseUrl: config.baseUrl, getToken: () => config.token, limit: 500 })
        : makeSeedSource();
      const entities = config ? SYNC_ENTITIES : SEED_ENTITIES;

      if (config) {
        engine.current = {
          repo: opened.repo,
          outbox: opened.outbox,
          source,
          transport: createHttpMutationTransport({ baseUrl: config.baseUrl, getToken: () => config.token }),
        };
      }

      // Initial hydration. With a backend, always pull fresh (server is the truth);
      // offline, seed only once (a durable store that already has data skips it).
      const existing = await opened.repo.list('projects');
      if (!config && existing.length > 0) {
        if (alive) setHydration({ ready: true, progress: 1 });
      } else {
        await hydrate(opened.repo, source, entities, (progress) => {
          if (alive) setHydration({ ready: false, progress });
        });
        if (alive) setHydration({ ready: true, progress: 1 });
      }

      if (config && alive) {
        setSync({ status: 'idle', pending: await opened.outbox.size() });
        // Gentle background loop so queued writes leave and server changes arrive.
        timer = setInterval(() => void runSync(), 8000);
      }
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [config, runSync]);

  const syncNow = useCallback(() => void runSync(), [runSync]);

  return (
    <DataContext.Provider value={{ repo, outbox, hydration, label, userId, sync, syncNow }}>
      {children}
    </DataContext.Provider>
  );
}
