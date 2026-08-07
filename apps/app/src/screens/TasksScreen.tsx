// Opgaver — tasks grouped by project, with a status filter (Alle/Åbne/Færdige) and a
// done/open toggle. Toggling flips the task's status through useWrite (optimistic UPDATE,
// queued in the outbox). Reads are reactive (useLiveList). AR-05: ui/i18n/db only.
import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Badge,
  Checkbox,
  Divider,
  EmptyState,
  IconBubble,
  SegmentedControl,
  useTheme,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite } from '../db/react';
import type { Row } from '../db';
import { groupTasksByProject } from './selectors';

type TaskFilter = 'all' | 'open' | 'done';

export function TasksScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hydration } = useData();
  const tasks = useLiveList('tasks');
  const projects = useLiveList('projects');
  const write = useWrite();
  const [filter, setFilter] = useState<TaskFilter>('all');

  const filtered =
    filter === 'all'
      ? tasks
      : tasks.filter((tk) => (filter === 'done' ? tk.status === 'done' : tk.status !== 'done'));
  const groups = groupTasksByProject(filtered, projects);

  const toggle = (task: Row, done: boolean): void => {
    void write.upsert('tasks', { ...task, status: done ? 'done' : 'open' });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">{t('tasks.title')}</Text>

        <SegmentedControl<TaskFilter>
          segments={[
            { value: 'all', label: t('tasks.filterAll') },
            { value: 'open', label: t('tasks.filterOpen') },
            { value: 'done', label: t('tasks.filterDone') },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {groups.length === 0 ? (
          hydration.ready ? (
            filter === 'all' ? (
              <EmptyState title={t('tasks.emptyTitle')} description={t('tasks.emptyBody')} icon="☑️" />
            ) : (
              <EmptyState title={t('tasks.noneMatch')} description={t('tasks.noneMatchBody')} icon="🔍" />
            )
          ) : null
        ) : (
          groups.map((g) => {
            const openCount = g.tasks.filter((task) => task.status !== 'done').length;
            return (
              <Card key={g.projectId}>
                <VStack gap="sm">
                  <HStack justify="space-between" align="center" gap="sm">
                    <HStack gap="sm" align="center" style={{ flex: 1 }}>
                      <IconBubble icon="folder" tone={openCount > 0 ? 'brand' : 'neutral'} size={34} />
                      <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                        {g.projectName ?? t('tasks.noProject')}
                      </Text>
                    </HStack>
                    <Badge
                      label={openCount > 0 ? String(openCount) : '✓'}
                      tone={openCount > 0 ? 'primary' : 'success'}
                    />
                  </HStack>
                  {g.tasks.map((task, i) => {
                    const done = task.status === 'done';
                    return (
                      <VStack key={String(task.id)} gap="none">
                        {i > 0 ? <Divider /> : null}
                        <HStack justify="space-between" align="center" gap="sm">
                          <Checkbox checked={done} onChange={(v) => toggle(task, v)} label={String(task.title)} />
                          <Badge label={done ? t('tasks.done') : t('tasks.open')} tone={done ? 'success' : 'primary'} />
                        </HStack>
                      </VStack>
                    );
                  })}
                </VStack>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
