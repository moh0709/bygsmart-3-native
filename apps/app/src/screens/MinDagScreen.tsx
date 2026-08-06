// Min Dag — the home worklist for a field app: every open task across all projects in
// one focused list, each with a one-tap "done". Marking done is an optimistic UPDATE
// through useWrite (queued in the outbox). Reactive reads keep it in sync as tasks
// change on any screen. AR-05: ui/i18n/db only.
import { ScrollView } from 'react-native';
import { Screen, VStack, Text, Card, IconButton, ListItem, Divider, EmptyState } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite } from '../db/react';
import type { Row } from '../db';
import { openTasksWithProject } from './selectors';
import { SyncBar } from './SyncBar';

export function MinDagScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { hydration } = useData();
  const tasks = useLiveList('tasks');
  const projects = useLiveList('projects');
  const write = useWrite();
  const open = openTasksWithProject(tasks, projects);

  const markDone = (task: Row): void => {
    void write.upsert('tasks', { ...task, status: 'done' });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <VStack gap="xs">
          <Text variant="display">{t('minDag.title')}</Text>
          <Text variant="body" color="textSecondary">
            {t('minDag.openCount', { count: open.length })}
          </Text>
        </VStack>

        <SyncBar />

        {open.length === 0 ? (
          <EmptyState
            title={hydration.ready ? t('minDag.allDoneTitle') : t('projects.syncing')}
            description={hydration.ready ? t('minDag.allDoneBody') : ''}
            icon="✅"
          />
        ) : (
          <Card>
            <VStack gap="sm">
              {open.map((o, i) => (
                <VStack key={String(o.task.id)} gap="none">
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    title={String(o.task.title)}
                    subtitle={o.projectName ?? t('tasks.noProject')}
                    leading="🔨"
                    trailing={
                      <IconButton
                        icon="✓"
                        accessibilityLabel={t('tasks.markDone')}
                        variant="filled"
                        onPress={() => markDone(o.task)}
                      />
                    }
                  />
                </VStack>
              ))}
            </VStack>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
