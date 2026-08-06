import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Button, Badge, ProgressBar, ListItem, Divider, EmptyState } from '@bygsmart/ui';
import {
  InMemoryRepository,
  InMemoryOutbox,
  SqlRepository,
  SqlOutbox,
  drain,
  upsertRow,
  electSingleWriter,
  hydrate,
  openChangeChannel,
  type ChangeChannel,
  type MutationResult,
  type MutationTransport,
  type Outbox,
  type OutboxMutation,
  type PullPage,
  type PullSource,
  type Repository,
  type Row,
} from '../src/db';

// P3a demo: repository contract + delta puller + reactive reads in the real app.
// NATIVE → persistent device SQLite (expo-sqlite); WEB → wasm SQLite over OPFS
// (survives reload). A single-writer election + cross-tab broadcast keep two browser
// tabs consistent. A fake PullSource stands in for GET /api/sync/:entity.
function task(id: string, title: string, project: string): Row {
  return { id, updated_at: new Date().toISOString(), title, project };
}

function makeSource(): PullSource {
  const script: Record<string, PullPage[]> = {
    tasks: [
      {
        rows: [
          task('t1', 'Støbe fundament', 'Villa Nord'),
          task('t2', 'Rejse spær', 'Villa Nord'),
          task('t3', 'Montér vinduer', 'Villa Syd'),
        ],
        deletes: [],
        nextCursor: 'c1',
        hasMore: false,
      },
    ],
  };
  const calls: Record<string, number> = {};
  return {
    async fetch(entity) {
      const i = calls[entity] ?? 0;
      calls[entity] = i + 1;
      await new Promise((r) => setTimeout(r, 400));
      return script[entity]?.[i] ?? { rows: [], deletes: [], nextCursor: null, hasMore: false };
    },
  };
}

// The repo AND the outbox share ONE device database (same driver), so both the synced
// rows and the unsent writes are durable together.
async function openRepo(): Promise<{ repo: Repository; outbox: Outbox; source: string }> {
  if (Platform.OS !== 'web') {
    const { openExpoSqliteDriver } = await import('../src/db/sql/expoSqliteDriver');
    const driver = await openExpoSqliteDriver('bygsmart-demo.db');
    return { repo: await SqlRepository.create(driver), outbox: await SqlOutbox.create(driver), source: 'enhed (SQLite)' };
  }
  const { opfsAvailable } = await import('../src/db/opfs/opfs');
  if (opfsAvailable()) {
    const { openWebSqlDriver } = await import('../src/db/sql/webSqlDriver');
    const driver = await openWebSqlDriver('bygsmart-demo.sqlite');
    return { repo: await SqlRepository.create(driver), outbox: await SqlOutbox.create(driver), source: 'browser (OPFS SQLite)' };
  }
  return { repo: new InMemoryRepository(), outbox: new InMemoryOutbox(), source: 'hukommelse (web)' };
}

// A stand-in for POST /api/sync/mutations — an in-memory "server" that applies the
// batch and echoes one result per mutation, so the whole write loop is visible on the
// device without the real backend. Refuses when "offline" (throws, like a dropped
// connection) so the outbox holds the writes until connectivity returns.
class FakeServer {
  rows = new Map<string, Row>();
  apply(muts: OutboxMutation[]): MutationResult[] {
    return muts.map((m) => {
      const id = (m.data as { id: string }).id;
      if (m.op === 'delete') {
        this.rows.delete(id);
        return { id: m.id, status: 'applied' };
      }
      const row = { ...(m.data as Row), updated_at: new Date().toISOString() };
      this.rows.set(id, row);
      return { id: m.id, status: 'applied', row };
    });
  }
}

export default function OfflineDemo() {
  const source = useMemo(makeSource, []);
  const nextId = useRef(4);
  const channelRef = useRef<ChangeChannel | null>(null);

  const [repo, setRepo] = useState<Repository | null>(null);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [isWriter, setIsWriter] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [fromDisk, setFromDisk] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  // Write-path (P3b) state.
  const server = useRef(new FakeServer());
  const onlineRef = useRef(true);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [serverCount, setServerCount] = useState(0);
  const [flushMsg, setFlushMsg] = useState('');

  // (Re)open the repo — also called when another tab broadcasts a change, so a
  // follower re-reads the shared OPFS store.
  const load = useCallback(async () => {
    const { repo: r, outbox: ob, source: label } = await openRepo();
    setRepo(r);
    setOutbox(ob);
    setSourceLabel(label);
    setPending(await ob.size());
    const existing = await r.list('tasks');
    if (existing.length > 0) {
      setFromDisk(true);
      setProgress(1);
      setReady(true);
      nextId.current = existing.length + 1;
    } else {
      await hydrate(r, source, ['tasks'], (p) => setProgress(p));
      setReady(true);
    }
  }, [source]);

  useEffect(() => {
    let mounted = true;
    void load();
    const election = electSingleWriter('bygsmart-demo');
    setIsWriter(election.isLeader());
    const offElection = election.onChange((v) => mounted && setIsWriter(v));
    const channel = openChangeChannel('bygsmart-demo', () => mounted && void load());
    channelRef.current = channel;
    return () => {
      mounted = false;
      offElection();
      election.release();
      channel.close();
    };
  }, [load]);

  useEffect(() => {
    if (!repo) return;
    const refresh = () => repo.list('tasks').then(setRows);
    const off = repo.subscribe('tasks', refresh);
    refresh();
    return off;
  }, [repo]);

  const announce = () => channelRef.current?.broadcast();
  const addFromServer = () => {
    if (!repo) return;
    const id = `t${nextId.current++}`;
    repo.applyDelta('tasks', { upserts: [task(id, `Ny opgave ${id}`, 'Villa Vest')], deletes: [] }).then(announce);
  };
  const deleteFirst = () => {
    if (repo && rows[0]?.id) repo.applyDelta('tasks', { upserts: [], deletes: [{ id: rows[0].id as string }] }).then(announce);
  };
  const reset = async () => {
    if (!repo) return;
    const all = await repo.list('tasks');
    await repo.applyDelta('tasks', { upserts: [], deletes: all.map((r) => ({ id: r.id as string })) });
    await repo.setCursor('tasks', null);
    setFromDisk(false);
    announce();
  };

  // Write path (P3b): the transport is the in-memory server, gated by the online flag.
  const transport: MutationTransport = useMemo(
    () => ({
      async send(muts) {
        if (!onlineRef.current) throw new Error('offline');
        await new Promise((r) => setTimeout(r, 300));
        return server.current.apply(muts);
      },
    }),
    [],
  );

  // Make a change offline: optimistic local write + enqueue in the durable outbox.
  const writeOffline = async () => {
    if (!repo || !outbox) return;
    const id = `local-${nextId.current++}`;
    await upsertRow(
      { repo, outbox, newId: () => `m-${id}`, now: () => new Date().toISOString() },
      'tasks',
      { id, updated_at: '', title: `Egen opgave ${id}`, project: 'Min enhed' },
    );
    setPending(await outbox.size());
    announce();
  };

  const toggleOnline = () => {
    onlineRef.current = !online;
    setOnline(!online);
  };

  // Ship the queue to the server; reconcile applied rows back into the local store.
  const sync = async () => {
    if (!repo || !outbox) return;
    setFlushMsg('Synkroniserer…');
    const summary = await drain(outbox, transport, {
      now: () => new Date().toISOString(),
      reconcile: async (entity, row) => repo.applyDelta(entity, { upserts: [row], deletes: [] }),
    });
    setPending(await outbox.size());
    setServerCount(server.current.rows.size);
    setFlushMsg(
      onlineRef.current
        ? `Sendt ${summary.applied} · fejl ${summary.failed} · konflikt ${summary.conflicts}`
        : 'Offline — ændringer venter i køen',
    );
    announce();
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <VStack gap="xs">
          <Text variant="heading">Offline-demo (P3a + P3b)</Text>
          <Text variant="caption" color="textSecondary">
            Lokal database · hydrering · live opdatering · offline skrivekø
          </Text>
        </VStack>

        <Card>
          <VStack gap="sm">
            <HStack justify="space-between" align="center">
              <Text variant="title">Synkronisering</Text>
              <Badge label={ready ? 'Klar' : 'Henter…'} tone={ready ? 'success' : 'pending'} />
            </HStack>
            <ProgressBar value={progress} tone={ready ? 'success' : 'primary'} label="Hydrering" />
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Badge label={`Kilde: ${sourceLabel || '…'}`} tone="neutral" />
              <Badge label={fromDisk ? 'Indlæst fra enheden' : 'Hydreret fra server'} tone={fromDisk ? 'primary' : 'neutral'} />
              <Badge label={isWriter ? 'Denne fane: Skriver' : 'Denne fane: Læser'} tone={isWriter ? 'success' : 'warning'} />
            </HStack>
            <Text variant="caption" color="textSecondary">
              {Math.round(progress * 100)}% · {rows.length} opgaver i lokal database
            </Text>
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Opgaver (fra lokal database)</Text>
            {rows.length === 0 ? (
              <EmptyState title="Ingen opgaver" description="Alt er synkroniseret væk." icon="✅" />
            ) : (
              rows.map((r, i) => (
                <VStack key={r.id as string} gap="none">
                  {i > 0 ? <Divider /> : null}
                  <ListItem title={String(r.title)} subtitle={String(r.project)} leading="🔨" />
                </VStack>
              ))
            )}
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Skriv offline (P3b)</Text>
            <Text variant="body" color="textSecondary">
              Egne ændringer gemmes straks lokalt og lægges i en holdbar kø. De sendes
              til serveren i rækkefølge, når du er online igen.
            </Text>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Badge label={`Ventende: ${pending}`} tone={pending > 0 ? 'warning' : 'success'} />
              <Badge label={online ? 'Online' : 'Offline'} tone={online ? 'success' : 'neutral'} />
              <Badge label={`Server har: ${serverCount}`} tone="neutral" />
            </HStack>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Button title="Tilføj opgave offline" onPress={writeOffline} />
              <Button title={online ? 'Gå offline' : 'Gå online'} variant="secondary" onPress={toggleOnline} />
              <Button title="Synkronisér nu" onPress={sync} />
            </HStack>
            {flushMsg ? (
              <Text variant="caption" color="textSecondary">
                {flushMsg}
              </Text>
            ) : null}
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Simulér serverændring</Text>
            <Text variant="body" color="textSecondary">
              Ændringer gemmes i den lokale database og deles med andre faner.
            </Text>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Button title="Ny opgave fra server" onPress={addFromServer} />
              <Button title="Slet første" variant="danger" onPress={deleteFirst} />
              <Button title="Nulstil" variant="secondary" onPress={reset} />
            </HStack>
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
