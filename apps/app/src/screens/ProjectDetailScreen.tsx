// Projekt-detalje — one project with its tasks. Adds a task SCOPED to the project
// (project_id set) and toggles task status, both optimistic writes through useWrite.
// Navigation-agnostic: it takes projectId + an onBack callback, so expo-router stays in
// the app-shell route and out of the screens element (AR-05).
import { ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Button, Badge, Checkbox, Divider, EmptyState } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveRow, useLiveList, useWrite, newMutationId } from '../db/react';
import type { Row } from '../db';
import { tasksForProject } from './selectors';

export interface ProjectDetailScreenProps {
  projectId: string;
  onBack?: () => void;
}

export function ProjectDetailScreen({ projectId, onBack }: ProjectDetailScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const { userId } = useData();
  const project = useLiveRow('projects', projectId);
  const allTasks = useLiveList('tasks');
  const write = useWrite();
  const tasks = tasksForProject(allTasks, projectId);

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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {onBack ? <Button title={t('common.back')} variant="ghost" onPress={onBack} /> : null}

        {!project ? (
          <EmptyState title={t('projectDetail.notFound')} icon="🏗️" />
        ) : (
          <>
            <VStack gap="xs">
              <Text variant="heading">{String(project.name)}</Text>
              {project.address ? (
                <Text variant="body" color="textSecondary">
                  {String(project.address)}
                </Text>
              ) : null}
            </VStack>

            <Button title={t('projectDetail.addTask')} onPress={addTask} />

            <Card>
              <VStack gap="sm">
                <Text variant="title">{t('projectDetail.tasksTitle')}</Text>
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
                          <Badge label={done ? t('tasks.done') : t('tasks.open')} tone={done ? 'success' : 'primary'} />
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
