import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Button, Badge, ProgressBar, ListItem, Divider, EmptyState } from '@bygsmart/ui';
import { InMemoryRepository, hydrate, type PullPage, type PullSource, type Row } from '../src/db';

// P3a demo: exercises the real repository contract + delta puller + reactive reads
// in the app on every target. A fake PullSource stands in for GET /api/sync/:entity
// so the offline read path is visible without the backend wired.
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
      // brief delay so the hydration progress bar is visible
      await new Promise((r) => setTimeout(r, 400));
      return script[entity]?.[i] ?? { rows: [], deletes: [], nextCursor: null, hasMore: false };
    },
  };
}

export default function OfflineDemo() {
  const repo = useMemo(() => new InMemoryRepository(), []);
  const source = useMemo(makeSource, []);
  const nextId = useRef(4);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  // Initial hydration with visible progress.
  useEffect(() => {
    hydrate(repo, source, ['tasks'], (p) => setProgress(p)).then(() => setReady(true));
  }, [repo, source]);

  // Reactive read — re-render whenever the local store changes.
  useEffect(() => {
    const refresh = () => {
      repo.list('tasks').then(setRows);
    };
    const off = repo.subscribe('tasks', refresh);
    refresh();
    return off;
  }, [repo]);

  const addFromServer = () => {
    const id = `t${nextId.current++}`;
    repo.applyDelta('tasks', { upserts: [task(id, `Ny opgave ${id}`, 'Villa Vest')], deletes: [] });
  };
  const deleteFirst = () => {
    if (rows[0]?.id) repo.applyDelta('tasks', { upserts: [], deletes: [{ id: rows[0].id as string }] });
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
              Trykker du her, anvender puller-laget en delta lokalt — listen opdateres live.
            </Text>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Button title="Ny opgave fra server" onPress={addFromServer} />
              <Button title="Slet første" variant="danger" onPress={deleteFirst} />
            </HStack>
          </VStack>
        </Card>
      </ScrollView>
    </Screen>
  );
}
