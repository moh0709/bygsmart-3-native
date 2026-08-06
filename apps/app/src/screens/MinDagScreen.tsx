// Min Dag — the home worklist for a field app: every open task across all projects in
// one focused list, each with a one-tap "done". Presentation adapts the 2.1 home (greeting
// + date header, section structure, elevated cards); the data path is unchanged. Marking
// done is an optimistic UPDATE through useWrite (queued in the outbox). Reactive reads keep
// it in sync as tasks change on any screen. AR-05: ui/i18n/api-client/db only.
import { ScrollView } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Badge,
  IconButton,
  ListItem,
  Divider,
  EmptyState,
  useTheme,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useOptionalSession } from '@bygsmart/api-client';
import { useData, useLiveList, useWrite } from '../db/react';
import type { Row } from '../db';
import { openTasksWithProject, danishGreeting, formatDanishDate, firstNameOf } from './selectors';
import { SyncBar } from './SyncBar';
import { ConflictBanner } from './ConflictBanner';

export function MinDagScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hydration } = useData();
  const auth = useOptionalSession();
  const tasks = useLiveList('tasks');
  const projects = useLiveList('projects');
  const write = useWrite();
  const open = openTasksWithProject(tasks, projects);

  const now = new Date();
  const firstName = firstNameOf(auth?.user?.user_metadata?.name);
  const greeting = danishGreeting(now) + (firstName ? `, ${firstName}` : '');
  const dateLine = formatDanishDate(now);

  const markDone = (task: Row): void => {
    void write.upsert('tasks', { ...task, status: 'done' });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {/* Greeting + date — the 2.1 home header signature */}
        <VStack gap="none">
          <Text variant="title">{greeting}</Text>
          <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
            {dateLine}
          </Text>
        </VStack>

        <SyncBar />
        <ConflictBanner />

        {open.length === 0 ? (
          <EmptyState
            title={hydration.ready ? t('minDag.allDoneTitle') : t('projects.syncing')}
            description={hydration.ready ? t('minDag.allDoneBody') : ''}
            icon="✅"
          />
        ) : (
          <VStack gap="sm">
            <HStack justify="space-between" align="center">
              <Text variant="heading">{t('minDag.todaysTasks')}</Text>
              <Badge label={String(open.length)} tone="primary" />
            </HStack>
            <Card>
              <VStack gap="none">
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
          </VStack>
        )}
      </ScrollView>
    </Screen>
  );
}
