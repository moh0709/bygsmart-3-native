import { Screen, EmptyState } from '@bygsmart/ui';

export default function Tasks() {
  return (
    <Screen edges={['top']}>
      <EmptyState title="Opgaver" description="Min Dag og opgavelister bygges i P5." icon="☑️" />
    </Screen>
  );
}
