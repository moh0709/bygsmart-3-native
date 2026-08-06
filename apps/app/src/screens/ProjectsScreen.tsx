// Projekter — live-reads projects + tasks from the local repository and shows each project
// as a card (name, status, task-progress). Creating a project is optimistic + queued
// through useWrite. Presentation adapts the 2.1 project cards; the data path is unchanged.
// No sync-engine imports (AR-05) — only ui, i18n, and the db hooks.
import { ScrollView } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Card,
  Button,
  Badge,
  ProgressBar,
  EmptyState,
  useTheme,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite, newMutationId } from '../db/react';
import { projectSummaries } from './selectors';

export interface ProjectsScreenProps {
  /** Navigate to a project's detail. Wired by the app-shell route (keeps expo-router out of screens). */
  onOpenProject?: (id: string) => void;
}

/** Status → badge tone. "I gang" is active (success), "Afsluttet" done (neutral), else primary. */
function statusTone(status: string): 'success' | 'neutral' | 'primary' {
  if (status === 'I gang') return 'success';
  if (status === 'Afsluttet' || status === 'Arkiveret') return 'neutral';
  return 'primary';
}

export function ProjectsScreen({ onOpenProject }: ProjectsScreenProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hydration, userId } = useData();
  const projects = useLiveList('projects');
  const tasks = useLiveList('tasks');
  const write = useWrite();
  const summaries = projectSummaries(projects, tasks);

  const addProject = (): void => {
    const n = projects.length + 1;
    void write.upsert('projects', {
      // RLS: projects_insert_own requires owner_id = auth.uid(); stamp it when signed in.
      id: newMutationId(),
      updated_at: '',
      name: `${t('projects.defaultName')} ${n}`,
      status: 'I gang',
      ...(userId ? { owner_id: userId } : {}),
    });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <HStack justify="space-between" align="center">
          <Text variant="title">{t('projects.title')}</Text>
          <Badge
            label={hydration.ready ? t('projects.ready') : t('projects.syncing')}
            tone={hydration.ready ? 'success' : 'pending'}
          />
        </HStack>

        {!hydration.ready ? <ProgressBar value={hydration.progress} label={t('projects.syncing')} /> : null}

        <Button title={t('projects.newProject')} onPress={addProject} />

        {summaries.length === 0 && hydration.ready ? (
          <EmptyState title={t('projects.emptyTitle')} description={t('projects.emptyBody')} icon="🏗️" />
        ) : (
          <VStack gap="md">
            {summaries.map((s) => {
              const done = s.total - s.open;
              const ratio = s.total > 0 ? done / s.total : 0;
              const status = String(s.project.status ?? '');
              const id = String(s.project.id);
              return (
                <Card key={id} onPress={onOpenProject ? () => onOpenProject(id) : undefined}>
                  <VStack gap="sm">
                    <HStack justify="space-between" align="center" gap="sm">
                      <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                        {String(s.project.name)}
                      </Text>
                      {status ? <Badge label={status} tone={statusTone(status)} /> : null}
                    </HStack>

                    {s.total > 0 ? (
                      <ProgressBar value={ratio} tone="success" label={String(s.project.name)} />
                    ) : null}

                    <HStack justify="space-between" align="center">
                      <Text variant="caption" color="textSecondary">
                        {s.total > 0
                          ? t('projects.taskSummary', { open: s.open, total: s.total })
                          : t('projects.noTasks')}
                      </Text>
                      {s.total > 0 ? (
                        <Text variant="caption" color="textTertiary">
                          {done}/{s.total}
                        </Text>
                      ) : null}
                    </HStack>
                  </VStack>
                </Card>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    </Screen>
  );
}
