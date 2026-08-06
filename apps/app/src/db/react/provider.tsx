// RepositoryProvider — opens the local database once, hydrates it, and exposes the
// repo + outbox + hydration state to the tree via context. Screens NEVER open the db or
// touch the sync engine (AR-05); they read through the hooks in ./hooks and write
// through useWrite. Mounted once in the app-shell _layout.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HydrationState, Repository } from '../contract';
import type { Outbox } from '../outbox/contract';
import { hydrate } from '../puller';
import { openDatabase } from './open';
import { makeSeedSource, SEED_ENTITIES } from './seed';

export interface DataContextValue {
  repo: Repository | null;
  outbox: Outbox | null;
  hydration: HydrationState;
  /** Runtime label (dev diagnostics). */
  label: string;
}

const DataContext = createContext<DataContextValue>({
  repo: null,
  outbox: null,
  hydration: { ready: false, progress: 0 },
  label: '',
});

export function useData(): DataContextValue {
  return useContext(DataContext);
}

export function RepositoryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const [label, setLabel] = useState('');
  const [hydration, setHydration] = useState<HydrationState>({ ready: false, progress: 0 });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // open exactly once
    started.current = true;
    let alive = true;
    void (async () => {
      const opened = await openDatabase();
      if (!alive) return;
      setRepo(opened.repo);
      setOutbox(opened.outbox);
      setLabel(opened.label);

      // Already have local data (durable store survived a restart) → skip re-hydration.
      const existing = await opened.repo.list('projects');
      if (existing.length > 0) {
        if (alive) setHydration({ ready: true, progress: 1 });
        return;
      }
      const source = makeSeedSource();
      await hydrate(opened.repo, source, SEED_ENTITIES, (progress) => {
        if (alive) setHydration({ ready: false, progress });
      });
      if (alive) setHydration({ ready: true, progress: 1 });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return <DataContext.Provider value={{ repo, outbox, hydration, label }}>{children}</DataContext.Provider>;
}
