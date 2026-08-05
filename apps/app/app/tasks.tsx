import { Screen, EmptyState } from '@bygsmart/ui';
import { useTranslation } from '@bygsmart/i18n';

export default function Tasks() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <EmptyState title={t('tasks.emptyTitle')} description={t('tasks.emptyBody')} icon="☑️" />
    </Screen>
  );
}
