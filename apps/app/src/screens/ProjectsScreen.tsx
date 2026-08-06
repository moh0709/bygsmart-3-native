// Projekter — the first real screen on the offline foundation. Live-reads projects +
// tasks from the local repository, shows each project's open/total task counts, and
// creates a project offline through useWrite (optimistic + queued). Hydration progress
// and the durable-store label come from the data context. No sync-engine imports here
// (AR-05) — only ui, i18n, and the db hooks.
import { ScrollView } from 'react-native';
import { Screen, VStack, HStack, Text, Card, Button, Badge, ProgressBar, ListItem, Divider, EmptyState } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';
import { useData, useLiveList, useWrite, newMutationId } from '../db/react';
import { projectSummaries } from './selectors';

export interface ProjectsScreenProps {
  /** Navigate to a project's detail. Wired by the app-shell route (keeps expo-router out of screens). */
  onOpenProject?: (id: string) => void;
}

export function ProjectsScreen({ onOpenProject }: ProjectsScreenProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { hydration } = useData();
  const projects = useLiveList('projects');
  const tasks = useLiveList('tasks');
  const write = useWrite();
  const summaries = projectSummaries(projects, tasks);

  const addProject = (): void => {
    const n = projects.length + 1;
    void write.upsert('projects', {
      id: `local-p-${newMutationId()}`,
      updated_at: '',
      name: `${t('projects.defaultName')} ${n}`,
      status: 'planning',
    });
  };

  return (
    <Screen edges={['top']} padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <HStack justify="space-between" align="center">
          <Text variant="heading">{t('projects.title')}</Text>
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
          <Card>
            <VStack gap="sm">
              {summaries.map((s, i) => (
                <VStack key={String(s.project.id)} gap="none">
                  {i > 0 ? <Divider /> : null}
                  <ListItem
                    title={String(s.project.name)}
                    subtitle={
                      s.total > 0
                        ? t('projects.taskSummary', { open: s.open, total: s.total })
                        : t('projects.noTasks')
                    }
                    leading="🏗️"
                    trailing={<Badge label={String(s.open)} tone={s.open > 0 ? 'primary' : 'neutral'} />}
                    onPress={onOpenProject ? () => onOpenProject(String(s.project.id)) : undefined}
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
