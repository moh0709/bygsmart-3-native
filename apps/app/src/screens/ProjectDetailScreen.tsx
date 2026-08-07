// Projekt-detalje — one project with its tasks. Presentation adapts the 2.1 project hero:
// a brand-gradient header (name + glass status chip + white progress) over a KPI row and
// the task list. Adds a task SCOPED to the project + toggles status, both optimistic writes
// through useWrite. Navigation-agnostic (projectId + onBack). AR-05.
import { ScrollView, View } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Button,
  Badge,
  Checkbox,
  Divider,
  EmptyState,
  IconButton,
  HeroCard,
  StatCard,
  useTheme,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveRow, useLiveList, useWrite, newMutationId } from '../db/react';
import { pickImage } from '../db/media/pickImage';
import type { Row } from '../db';
import { tasksForProject } from './selectors';

export interface ProjectDetailScreenProps {
  projectId: string;
  onBack?: () => void;
}

export function ProjectDetailScreen({ projectId, onBack }: ProjectDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { userId, attachMedia } = useData();
  const project = useLiveRow('projects', projectId);
  const allTasks = useLiveList('tasks');
  const write = useWrite();
  const tasks = tasksForProject(allTasks, projectId);
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const openCount = tasks.length - doneCount;
  const ratio = tasks.length > 0 ? doneCount / tasks.length : 0;
  const pct = Math.round(ratio * 100);

  const attach = async (task: Row): Promise<void> => {
    const picked = await pickImage();
    if (picked) await attachMedia('tasks', String(task.id), projectId, picked);
  };
  const attachmentCount = (task: Row): number => (Array.isArray(task.attachments) ? task.attachments.length : 0);

  const addTask = (): void => {
    const n = tasks.length + 1;
    void write.upsert('tasks', {
      id: newMutationId(),
      updated_at: '',
      title: `${t('projectDetail.newTaskTitle')} ${n}`,
      project_id: projectId,
      scope: 'project',
      status: 'To Do',
      ...(userId ? { owner_id: userId } : {}),
    });
  };

  const toggle = (task: Row, done: boolean): void => {
    void write.upsert('tasks', { ...task, status: done ? 'done' : 'open' });
  };

  const white = { color: '#FFFFFF' } as const;
  const whiteDim = { color: 'rgba(255,255,255,0.85)' } as const;

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {onBack ? (
          <Button title={`← ${t('common.back')}`} variant="ghost" size="sm" onPress={onBack} style={{ alignSelf: 'flex-start' }} />
        ) : null}

        {!project ? (
          <EmptyState title={t('projectDetail.notFound')} icon="🏗️" />
        ) : (
          <>
            {/* Brand hero header */}
            <HeroCard variant="brand">
              <VStack gap="sm">
                <HStack justify="space-between" align="flex-start" gap="sm">
                  <Text variant="title" numberOfLines={2} style={{ ...white, flex: 1 }}>
                    {String(project.name)}
                  </Text>
                  {project.status ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: theme.radii.pill,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                      }}
                    >
                      <Text variant="caption" style={{ ...white, fontWeight: '700' }}>
                        {String(project.status)}
                      </Text>
                    </View>
                  ) : null}
                </HStack>
                {project.address ? (
                  <Text variant="body" style={whiteDim}>
                    {String(project.address)}
                  </Text>
                ) : null}
                {tasks.length > 0 ? (
                  <VStack gap="xs">
                    <View
                      style={{
                        height: 8,
                        borderRadius: theme.radii.pill,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        overflow: 'hidden',
                      }}
                    >
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#FFFFFF' }} />
                    </View>
                    <HStack justify="space-between">
                      <Text variant="caption" style={whiteDim}>
                        {t('projects.taskSummary', { open: openCount, total: tasks.length })}
                      </Text>
                      <Text variant="caption" style={{ ...white, fontWeight: '700' }}>
                        {pct}%
                      </Text>
                    </HStack>
                  </VStack>
                ) : null}
              </VStack>
            </HeroCard>

            {/* KPI row */}
            {tasks.length > 0 ? (
              <HStack gap="sm">
                <StatCard value={openCount} label={t('minDag.statOpen')} icon="clock" tone="warning" />
                <StatCard value={doneCount} label={t('minDag.statDone')} icon="check" tone="success" />
              </HStack>
            ) : null}

            <Button title={t('projectDetail.addTask')} onPress={addTask} />

            <Card>
              <VStack gap="sm">
                <HStack justify="space-between" align="center" gap="sm">
                  <Text variant="heading" style={{ flex: 1 }}>
                    {t('projectDetail.tasksTitle')}
                  </Text>
                  {tasks.length > 0 ? (
                    <Badge label={openCount > 0 ? String(openCount) : '✓'} tone={openCount > 0 ? 'primary' : 'success'} />
                  ) : null}
                </HStack>
                {tasks.length === 0 ? (
                  <EmptyState title={t('tasks.emptyTitle')} description={t('tasks.emptyBody')} icon="☑️" />
                ) : (
                  tasks.map((task, i) => {
                    const done = task.status === 'done';
                    return (
                      <VStack key={String(task.id)} gap="none">
                        {i > 0 ? <Divider /> : null}
                        <HStack justify="space-between" align="center" gap="sm">
                          <Checkbox checked={done} onChange={(v) => toggle(task, v)} label={String(task.title)} />
                          <HStack gap="sm" align="center">
                            {attachmentCount(task) > 0 ? (
                              <Badge label={t('media.count', { count: attachmentCount(task) })} tone="neutral" />
                            ) : null}
                            <IconButton icon="📎" accessibilityLabel={t('media.attach')} onPress={() => void attach(task)} />
                            <Badge label={done ? t('tasks.done') : t('tasks.open')} tone={done ? 'success' : 'primary'} />
                          </HStack>
                        </HStack>
                      </VStack>
                    );
                  })
                )}
              </VStack>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
