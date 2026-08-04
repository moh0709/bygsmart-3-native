import { Screen, EmptyState } from '@bygsmart/ui';

export default function Projects() {
  return (
    <Screen edges={['top']}>
      <EmptyState title="Projekter" description="Projektlisten bygges i P5." icon="🏗️" />
    </Screen>
  );
}
