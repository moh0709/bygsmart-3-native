import { ScrollView } from 'react-native';
import {
  Screen,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  Badge,
  Spinner,
  Divider,
  useBreakpoint,
  useOutdoorMode,
} from '@bygsmart/ui';

/** P1 primitive gallery — proves the design system renders on all three targets (G1). */
export default function Gallery() {
  const bp = useBreakpoint();
  const { outdoor, setOutdoor } = useOutdoorMode();
  const noop = () => {};

  return (
    <Screen padding="none">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <VStack gap="xs">
          <Text variant="display">BygSmart 3.0</Text>
          <Text variant="body" color="textSecondary">
            Primitive gallery · {bp.name} · {bp.width}dp {bp.isTabletUp ? '(two-pane)' : '(single-pane)'}
          </Text>
        </VStack>

        <Card>
          <VStack gap="md">
            <Text variant="title">Handlinger</Text>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Button title="Primær" onPress={noop} />
              <Button title="Sekundær" variant="secondary" onPress={noop} />
              <Button title="Ghost" variant="ghost" onPress={noop} />
              <Button title="Slet" variant="danger" onPress={noop} />
              <Button title="Gemmer" loading onPress={noop} />
            </HStack>
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Synk-status</Text>
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Badge label="Synkroniseret" tone="success" />
              <Badge label="Venter (3)" tone="pending" />
              <Badge label="Synkroniserer" tone="primary" />
              <Badge label="Fejlet" tone="danger" />
            </HStack>
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Typografi</Text>
            <Text variant="heading">Overskrift</Text>
            <Text variant="body">Brødtekst — læsbar i sol og med handsker.</Text>
            <Divider />
            <Text variant="caption" color="textSecondary">Billedtekst</Text>
          </VStack>
        </Card>

        <Button
          title={outdoor ? 'Udendørs højkontrast: TIL' : 'Udendørs højkontrast: FRA'}
          variant="secondary"
          onPress={() => setOutdoor(!outdoor)}
        />

        <Card>
          <Spinner label="Indlæser…" />
        </Card>
      </ScrollView>
    </Screen>
  );
}
