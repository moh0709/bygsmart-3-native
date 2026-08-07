// Projekter — live-reads projects + tasks and shows each as a rich card (gradient icon
// tile + name + status + task-progress). Creating a project is optimistic + queued through
// useWrite. Presentation adapts the 2.1 project cards; data path unchanged. AR-05: only ui,
// i18n, and the db hooks.
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
  IconBubble,
  useTheme,
  type BubbleTone,
} from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite, newMutationId } from '../db/react';
import { projectSummaries } from './selectors';

export interface ProjectsScreenProps {
  onOpenProject?: (id: string) => void;
}

const DONE_STATUSES = ['Afsluttet', 'Arkiveret', 'done', 'archived'];

/** Status → status-chip tone. */
function statusTone(status: string): 'success' | 'neutral' | 'primary' {
  if (status === 'I gang' || status === 'active') return 'success';
  if (DONE_STATUSES.includes(status)) return 'neutral';
  return 'primary';
}
/** Status → icon-bubble tone. */
function bubbleTone(status: string): BubbleTone {
  if (DONE_STATUSES.includes(status)) return 'neutral';
  if (status === 'planning' || status === 'Planlægning') return 'info';
  return 'brand';
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
                  <HStack gap="md" align="flex-start">
                    <IconBubble icon="folder" tone={bubbleTone(status)} size={44} />
                    <VStack gap="xs" flex={1}>
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
                  </HStack>
                </Card>
              );
            })}
          </VStack>
        )}
      </ScrollView>
    </Screen>
  );
}
