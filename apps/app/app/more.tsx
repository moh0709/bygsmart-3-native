import { Screen, VStack, Text, Card, Badge } from '@bygsmart/ui';

export default function More() {
  return (
    <Screen edges={['top']}>
      <VStack gap="md">
        <Text variant="heading">Mere</Text>
        <Card>
          <VStack gap="sm">
            <Text variant="title">BygSmart 3.0 Native</Text>
            <Text variant="body" color="textSecondary">Universal app · P1 foundation</Text>
            <Badge label="Udvikling" tone="pending" />
          </VStack>
        </Card>
      </VStack>
    </Screen>
  );
}
