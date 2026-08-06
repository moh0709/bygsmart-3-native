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
import { SYNC_ENTITIES } from './config';
import { listConflicts, applyConflictResolution, type ConflictChoice, type ConflictInfo } from './conflicts';
import { newMutationId, nowIso } from './newId';
import { electSingleWriter, type WriterElection } from '../writerElection';
import { openChangeChannel, type ChangeChannel } from '../crossTab';
import { upsertRow } from '../outbox/writes';
import { drainMedia, type MediaTransport } from '../media/uploader';
import type { MediaQueue, MediaStore } from '../media/contract';
import { createMediaStore } from '../media/mediaStore';
import type { PickedImage } from '../media/pickImage';
import type { Row } from '../contract';

/** Backend wiring supplied by the app-shell once the user is signed in (null = offline). */
export interface BackendConfig {
  /** Express sync API origin incl. /api. */
  baseUrl: string;
  /** Current access token, refreshed as needed (from the auth session). */
  getToken: () => Promise<string | null>;
  /** Signed-in user id — stamps owner_id on creates. */
  userId: string;
  /** Ships attachment bytes to Supabase Storage (built from the auth client). */
  mediaTransport: MediaTransport;
}

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
  /** Writes the server rejected on a version/permission clash, awaiting a decision. */
  conflicts: ConflictInfo[];
  /** Resolve one parked conflict: keep the server row or re-queue mine on top. */
  resolveConflict: (id: string, choice: ConflictChoice) => void;
  /** Attachment uploads still queued for Storage. */
  mediaPending: number;
  /** Queue a photo/attachment for a task (durable; uploaded on the next sync). */
  attachMedia: (entity: string, entityId: string, projectId: string, file: PickedImage) => Promise<void>;
  /** This tab owns the writes (single-writer election). Followers read; they don't sync. */
  isWriter: boolean;
}

const DataContext = createContext<DataContextValue>({
  repo: null,
  outbox: null,
  hydration: { ready: false, progress: 0 },
  label: '',
  userId: null,
  sync: { status: 'offline', pending: 0 },
  syncNow: () => {},
  conflicts: [],
  resolveConflict: () => {},
  mediaPending: 0,
  attachMedia: async () => {},
  isWriter: true,
});

export function useData(): DataContextValue {
  return useContext(DataContext);
}

export function RepositoryProvider({
  backend = null,
  children,
}: {
  /** Set by the app-shell once signed in; null = offline-first on the local seed. */
  backend?: BackendConfig | null;
  children: ReactNode;
}): React.JSX.Element {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const [label, setLabel] = useState('');
  const [hydration, setHydration] = useState<HydrationState>({ ready: false, progress: 0 });
  const [sync, setSync] = useState<SyncState>({ status: 'offline', pending: 0 });
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [mediaPending, setMediaPending] = useState(0);
  const [isWriter, setIsWriter] = useState(true);
  const started = useRef(false);
  const writerRef = useRef(true); // read synchronously inside runSync
  const channelRef = useRef<ChangeChannel | null>(null);
  const electionRef = useRef<WriterElection | null>(null);

  const config = useRef(backend).current; // captured once; the app-shell remounts on sign-in/out
  const userId = config?.userId ?? null;

  // Stable engine refs. `local` (repo/outbox/media/store) exists in both modes; `remote`
  // (sync source/transport/media transport) only when a backend is configured.
  const engine = useRef<{ repo: Repository; outbox: Outbox; media: MediaQueue; store: MediaStore } | null>(null);
  const remote = useRef<{ source: PullSource; transport: MutationTransport; mediaTransport: MediaTransport } | null>(null);

  const runSync = useCallback(async () => {
    const e = engine.current;
    const r = remote.current;
    if (!e || !r) return;
    // Single-writer: only the elected tab flushes/pulls, so two tabs never write the
    // shared OPFS database at once. Followers read; the writer broadcasts when done.
    if (!writerRef.current) return;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      // Push local writes first, then pull server truth (so our own writes come back
      // authoritative), applying upserts into the store on the way in.
      await drain(e.outbox, r.transport, {
        now: () => new Date().toISOString(),
        reconcile: async (entity, row) => e.repo.applyDelta(entity, { upserts: [row], deletes: [] }),
      });
      for (const entity of SYNC_ENTITIES) await pullEntity(e.repo, r.source, entity);

      // Ship queued attachments to Storage; on success, record the reference on the row.
      await drainMedia(e.media, {
        now: () => new Date().toISOString(),
        store: e.store,
        transport: r.mediaTransport,
        onUploaded: async (entry) => {
          const row = await e.repo.get(entry.entity, entry.entityId);
          if (!row) return;
          const attachments = Array.isArray(row.attachments) ? (row.attachments as unknown[]) : [];
          const updated: Row = {
            ...row,
            attachments: [...attachments, { path: entry.path, contentType: entry.contentType, uploadedAt: nowIso() }],
          };
          await upsertRow({ repo: e.repo, outbox: e.outbox, newId: newMutationId, now: nowIso }, entry.entity, updated);
        },
      });

      setSync({ status: 'idle', pending: await e.outbox.size() });
      setConflicts(listConflicts(await e.outbox.all()));
      setMediaPending(await e.media.pendingCount());
      // Tell follower tabs the shared store changed so they re-read it.
      channelRef.current?.broadcast();
    } catch (err) {
      setSync((s) => ({ ...s, status: 'error', lastError: err instanceof Error ? err.message : String(err) }));
    }
  }, []);

  const attachMedia = useCallback(
    async (entity: string, entityId: string, projectId: string, file: PickedImage) => {
      const e = engine.current;
      if (!e) return;
      const id = newMutationId();
      await e.store.put(id, file.bytes);
      const ext = file.contentType === 'image/png' ? 'png' : file.contentType === 'image/jpeg' ? 'jpg' : 'bin';
      await e.media.enqueue({
        id,
        bucket: 'task-docs',
        path: `${projectId}/${entityId}/${id}.${ext}`,
        contentType: file.contentType,
        size: file.bytes.length,
        entity,
        entityId,
      });
      setMediaPending(await e.media.pendingCount());
      void runSync();
    },
    [runSync],
  );

  const resolveConflict = useCallback(
    (id: string, choice: ConflictChoice) => {
      void (async () => {
        const e = engine.current;
        if (!e) return;
        const entry = (await e.outbox.all()).find((x) => x.id === id);
        if (!entry) return;
        await applyConflictResolution(e.repo, e.outbox, entry, choice, newMutationId);
        setConflicts(listConflicts(await e.outbox.all()));
        void runSync();
      })();
    },
    [runSync],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Backend mode uses a PER-USER database so signing in as a different user never shows
    // the previous user's cached rows (and it never inherits the offline seed's cursors).
    const dbName = config ? `bygsmart-live-${config.userId}` : 'bygsmart-app';
    const store = createMediaStore();

    // Single-writer election (web multi-tab; native is always the writer). Followers
    // don't sync — they re-open the shared store when the writer broadcasts a change.
    const election = electSingleWriter(`writer-${dbName}`);
    electionRef.current = election;
    writerRef.current = election.isLeader();
    setIsWriter(election.isLeader());
    const offElection = election.onChange((leader) => {
      writerRef.current = leader;
      if (alive) setIsWriter(leader);
      if (leader) void runSync(); // a promoted follower starts syncing immediately
    });

    const reopenReads = async (): Promise<void> => {
      const o = await openDatabase(dbName);
      if (!alive) return;
      engine.current = { repo: o.repo, outbox: o.outbox, media: o.media, store };
      setRepo(o.repo);
      setOutbox(o.outbox);
    };
    const channel = openChangeChannel(`changed-${dbName}`, () => {
      if (!writerRef.current) void reopenReads(); // only followers reload; the writer is the source
    });
    channelRef.current = channel;

    void (async () => {
      const opened = await openDatabase(dbName);
      if (!alive) return;
      setRepo(opened.repo);
      setOutbox(opened.outbox);
      setLabel(opened.label);
      engine.current = { repo: opened.repo, outbox: opened.outbox, media: opened.media, store };

      const source: PullSource = config
        ? createHttpPullSource({ baseUrl: config.baseUrl, getToken: config.getToken, limit: 500 })
        : makeSeedSource();
      const entities = config ? SYNC_ENTITIES : SEED_ENTITIES;

      if (config) {
        remote.current = {
          source,
          transport: createHttpMutationTransport({ baseUrl: config.baseUrl, getToken: config.getToken }),
          mediaTransport: config.mediaTransport,
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
        setMediaPending(await opened.media.pendingCount());
        // Gentle background loop so queued writes leave and server changes arrive.
        timer = setInterval(() => void runSync(), 8000);
      }
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      offElection();
      election.release();
      channel.close();
    };
  }, [config, runSync]);

  const syncNow = useCallback(() => void runSync(), [runSync]);

  return (
    <DataContext.Provider
      value={{ repo, outbox, hydration, label, userId, sync, syncNow, conflicts, resolveConflict, mediaPending, attachMedia, isWriter }}
    >
      {children}
    </DataContext.Provider>
  );
}
