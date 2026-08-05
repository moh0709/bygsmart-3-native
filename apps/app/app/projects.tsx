import { Screen, EmptyState } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';

export default function Projects() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <EmptyState title={t('projects.emptyTitle')} description={t('projects.emptyBody')} icon="🏗️" />
    </Screen>
  );
}
