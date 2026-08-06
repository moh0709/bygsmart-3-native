import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Button, Badge, ProgressBar, ListItem, Divider, EmptyState } from '@bygsmart/ui';
import {
  InMemoryRepository,
  SqlRepository,
  hydrate,
  type PullPage,
  type PullSource,
  type Repository,
  type Row,
} from '../src/db';

// P3a demo: the repository contract + delta puller + reactive reads in the real app.
// On NATIVE it runs on a persistent device SQLite file (data survives restarts); on
// web it uses the in-memory runtime for now (OPFS persistence is a later step). A fake
// PullSource stands in for GET /api/sync/:entity so the read path is visible with no backend.
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

async function openRepo(): Promise<{ repo: Repository; source: string }> {
  if (Platform.OS === 'web') return { repo: new InMemoryRepository(), source: 'hukommelse (web)' };
  const { openExpoSqliteDriver } = await import('../src/db/sql/expoSqliteDriver');
  return { repo: await SqlRepository.create(await openExpoSqliteDriver('bygsmart-demo.db')), source: 'enhed (SQLite)' };
}

export default function OfflineDemo() {
  const source = useMemo(makeSource, []);
  const nextId = useRef(4);

  const [repo, setRepo] = useState<Repository | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [fromDisk, setFromDisk] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { repo: r, source: label } = await openRepo();
      if (!mounted) return;
      setRepo(r);
      setSourceLabel(label);
      const existing = await r.list('tasks');
      if (existing.length > 0) {
        // Data was already on the device from a previous run — the restart proof.
        setFromDisk(true);
        setProgress(1);
        setReady(true);
        nextId.current = existing.length + 1;
      } else {
        await hydrate(r, source, ['tasks'], (p) => setProgress(p));
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [source]);

  useEffect(() => {
    if (!repo) return;
    const refresh = () => repo.list('tasks').then(setRows);
    const off = repo.subscribe('tasks', refresh);
    refresh();
    return off;
  }, [repo]);

  const addFromServer = () => {
    if (!repo) return;
    const id = `t${nextId.current++}`;
    repo.applyDelta('tasks', { upserts: [task(id, `Ny opgave ${id}`, 'Villa Vest')], deletes: [] });
  };
  const deleteFirst = () => {
    if (repo && rows[0]?.id) repo.applyDelta('tasks', { upserts: [], deletes: [{ id: rows[0].id as string }] });
  };
  const reset = async () => {
    if (!repo) return;
    const all = await repo.list('tasks');
    await repo.applyDelta('tasks', { upserts: [], deletes: all.map((r) => ({ id: r.id as string })) });
    await repo.setCursor('tasks', null);
    setFromDisk(false);
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <VStack gap="xs">
          <Text variant="heading">Offline-demo (P3a)</Text>
          <Text variant="caption" color="textSecondary">
            Lokal database · hydrering · live opdatering
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
            <Text variant="title">Simulér serverændring</Text>
            <Text variant="body" color="textSecondary">
              Ændringer gemmes i den lokale database og overlever en genstart af appen.
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
