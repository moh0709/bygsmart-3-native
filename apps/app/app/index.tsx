import { useState } from 'react';
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
  TextField,
  Checkbox,
  Switch,
  RadioGroup,
  SegmentedControl,
  Chip,
  Avatar,
  IconButton,
  ListItem,
  ProgressBar,
  Grid,
  useBreakpoint,
  useOutdoorMode,
} from '@bygsmart/ui';

/** P1 primitive gallery — proves the design system renders on all three targets (G1). */
export default function Gallery() {
  const bp = useBreakpoint();
  const { outdoor, setOutdoor } = useOutdoorMode();
  const noop = () => {};

  const [text, setText] = useState('');
  const [checked, setChecked] = useState(true);
  const [toggle, setToggle] = useState(false);
  const [radio, setRadio] = useState<'dag' | 'uge'>('dag');
  const [view, setView] = useState<'liste' | 'kort'>('liste');
  const [chip, setChip] = useState(true);

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
              <IconButton icon="＋" accessibilityLabel="Tilføj" onPress={noop} variant="filled" />
            </HStack>
          </VStack>
        </Card>

        <Card>
          <VStack gap="md">
            <Text variant="title">Formularer</Text>
            <TextField label="Projektnavn" placeholder="F.eks. Villa Nord" value={text} onChangeText={setText} />
            <TextField label="E-mail" value="ugyldig" error="Ugyldig e-mail" />
            <Checkbox checked={checked} onChange={setChecked} label="Send mig notifikationer" />
            <Switch value={toggle} onValueChange={setToggle} label="Offline-tilstand" />
            <RadioGroup
              label="Visning"
              value={radio}
              onChange={setRadio}
              options={[
                { value: 'dag', label: 'Min dag' },
                { value: 'uge', label: 'Min uge' },
              ]}
            />
            <SegmentedControl
              value={view}
              onChange={setView}
              segments={[
                { value: 'liste', label: 'Liste' },
                { value: 'kort', label: 'Kort' },
              ]}
            />
            <HStack gap="sm" style={{ flexWrap: 'wrap' }}>
              <Chip label="BR18" selected={chip} onPress={() => setChip((v) => !v)} icon="📘" />
              <Chip label="Isolering" onPress={noop} />
              <Chip label="Beton" onPress={noop} />
            </HStack>
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Lister</Text>
            <ListItem title="Villa Nord" subtitle="3 aktive opgaver" leading="🏗️" trailing={<Badge label="I gang" tone="primary" />} onPress={noop} />
            <Divider />
            <ListItem title="Mikkel Overgaard" subtitle="Formand" trailing={<Avatar name="Mikkel Overgaard" size="sm" />} onPress={noop} />
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Fremdrift</Text>
            <ProgressBar value={0.7} label="Projekt" />
            <ProgressBar value={0.3} tone="warning" />
            <ProgressBar value={1} tone="success" />
          </VStack>
        </Card>

        <Card>
          <VStack gap="sm">
            <Text variant="title">Responsivt gitter</Text>
            <Grid>
              {['Areal', 'Beton', 'Isolering', 'Maling', 'Fliser', 'Tag'].map((c) => (
                <Card key={c} padded>
                  <Text variant="label" center>
                    {c}
                  </Text>
                </Card>
              ))}
            </Grid>
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
