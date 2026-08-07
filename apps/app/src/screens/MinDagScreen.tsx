// Min Dag — the home worklist for a field app. Presentation adapts the 2.1 home: avatar +
// greeting header, a "Mit overblik" KPI grid (gradient icon bubbles), then the day's tasks
// in an elevated card. The data path is unchanged (reactive reads + optimistic done through
// useWrite/outbox). AR-05: ui/i18n/api-client/db only.
import { ScrollView } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Badge,
  Avatar,
  StatCard,
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

export function MinDagScreen({
  onOpenProjects,
  onOpenTasks,
}: {
  onOpenProjects?: () => void;
  onOpenTasks?: () => void;
} = {}): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hydration } = useData();
  const auth = useOptionalSession();
  const tasks = useLiveList('tasks');
  const projects = useLiveList('projects');
  const write = useWrite();
  const open = openTasksWithProject(tasks, projects);

  const now = new Date();
  const displayName = (auth?.user?.user_metadata?.name as string | undefined) ?? undefined;
  const firstName = firstNameOf(displayName);
  const greeting = danishGreeting(now) + (firstName ? `, ${firstName}` : '');
  const dateLine = formatDanishDate(now);

  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const openCount = tasks.length - doneCount;

  const markDone = (task: Row): void => {
    void write.upsert('tasks', { ...task, status: 'done' });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {/* Header: avatar + date + greeting (2.1 home signature) */}
        <HStack gap="md" align="center">
          <Avatar name={displayName || 'BygSmart'} />
          <VStack gap="none" flex={1}>
            <Text variant="caption" color="textTertiary">
              {dateLine}
            </Text>
            <Text variant="title" numberOfLines={1}>
              {greeting}
            </Text>
          </VStack>
        </HStack>

        <SyncBar />
        <ConflictBanner />

        {/* Mit overblik — KPI grid with gradient icon bubbles */}
        <VStack gap="sm">
          <Text variant="heading">{t('minDag.overview')}</Text>
          <HStack gap="sm">
            <StatCard value={projects.length} label={t('minDag.statProjects')} icon="folder" tone="brand" onPress={onOpenProjects} />
            <StatCard value={openCount} label={t('minDag.statOpen')} icon="clock" tone="warning" onPress={onOpenTasks} />
          </HStack>
          <HStack gap="sm">
            <StatCard value={doneCount} label={t('minDag.statDone')} icon="check" tone="success" onPress={onOpenTasks} />
            <StatCard value={tasks.length} label={t('minDag.statTotal')} icon="tasks" tone="info" onPress={onOpenTasks} />
          </HStack>
        </VStack>

        {/* Dagens opgaver */}
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
