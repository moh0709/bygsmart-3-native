// Opgaver — tasks grouped by project, each with a done/open toggle. Toggling flips the
// task's status through useWrite, which is an UPDATE (the row already has an
// updated_at, sent as baseVersion for optimistic concurrency) applied optimistically
// and queued in the outbox. Reads are reactive (useLiveList). AR-05: ui/i18n/db only.
import { ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Badge, Checkbox, Divider, EmptyState, IconBubble, useTheme } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite } from '../db/react';
import type { Row } from '../db';
import { groupTasksByProject } from './selectors';

export function TasksScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hydration } = useData();
  const tasks = useLiveList('tasks');
  const projects = useLiveList('projects');
  const write = useWrite();
  const groups = groupTasksByProject(tasks, projects);

  const toggle = (task: Row, done: boolean): void => {
    void write.upsert('tasks', { ...task, status: done ? 'done' : 'open' });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">{t('tasks.title')}</Text>

        {groups.length === 0 && hydration.ready ? (
          <EmptyState title={t('tasks.emptyTitle')} description={t('tasks.emptyBody')} icon="☑️" />
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
