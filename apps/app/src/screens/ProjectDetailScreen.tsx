// Projekt-detalje — one project with its tasks. Adds a task SCOPED to the project
// (project_id set) and toggles task status, both optimistic writes through useWrite.
// Navigation-agnostic: it takes projectId + an onBack callback, so expo-router stays in
// the app-shell route and out of the screens element (AR-05).
import { ScrollView } from 'react-native';
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

function statusTone(status: string): 'success' | 'neutral' | 'primary' {
  if (status === 'I gang') return 'success';
  if (status === 'Afsluttet' || status === 'Arkiveret') return 'neutral';
  return 'primary';
}

export function ProjectDetailScreen({ projectId, onBack }: ProjectDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { userId, attachMedia } = useData();
  const project = useLiveRow('projects', projectId);
  const allTasks = useLiveList('tasks');
  const write = useWrite();
  const tasks = tasksForProject(allTasks, projectId);
  const openCount = tasks.filter((task) => task.status !== 'done').length;

  const attach = async (task: Row): Promise<void> => {
    const picked = await pickImage();
    if (picked) await attachMedia('tasks', String(task.id), projectId, picked);
  };
  const attachmentCount = (task: Row): number => (Array.isArray(task.attachments) ? task.attachments.length : 0);

  const addTask = (): void => {
    const n = tasks.length + 1;
    void write.upsert('tasks', {
      // uuid PK; project-scoped task (RLS: tasks_insert_project needs project ownership).
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
            <VStack gap="xs">
              <HStack justify="space-between" align="center" gap="sm">
                <Text variant="title" numberOfLines={2} style={{ flex: 1 }}>
                  {String(project.name)}
                </Text>
                {project.status ? (
                  <Badge label={String(project.status)} tone={statusTone(String(project.status))} />
                ) : null}
              </HStack>
              {project.address ? (
                <Text variant="body" color="textSecondary">
                  {String(project.address)}
                </Text>
              ) : null}
            </VStack>

            <Button title={t('projectDetail.addTask')} onPress={addTask} />

            <Card>
              <VStack gap="sm">
                <HStack justify="space-between" align="center" gap="sm">
                  <Text variant="heading" style={{ flex: 1 }}>
                    {t('projectDetail.tasksTitle')}
                  </Text>
                  {tasks.length > 0 ? (
                    <Badge
                      label={openCount > 0 ? String(openCount) : '✓'}
                      tone={openCount > 0 ? 'primary' : 'success'}
                    />
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
