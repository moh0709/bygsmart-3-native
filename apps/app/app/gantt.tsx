import { Screen, Text, VStack, GanttView, type GanttRow } from '@bygsmart/ui';

// P1 1.7 Gantt canary route — renders the throwaway GanttView on all three targets
// so the universality verdict can be recorded (docs/mobile-fork/P1_GANTT_CANARY.md).
const ROWS: GanttRow[] = [
  { id: '1', label: 'Nedrivning', bars: [{ start: 0, end: 3, label: 'Nedrivning', tone: 'danger' }] },
  { id: '2', label: 'Fundament', bars: [{ start: 2, end: 6, label: 'Støbning', tone: 'primary' }] },
  { id: '3', label: 'Råhus', bars: [{ start: 5, end: 11, label: 'Rejsning', tone: 'primary' }] },
  { id: '4', label: 'Tag', bars: [{ start: 10, end: 14, label: 'Tagdækning', tone: 'warning' }] },
  { id: '5', label: 'El & VVS', bars: [
    { start: 8, end: 12, label: 'El', tone: 'success' },
    { start: 12, end: 16, label: 'VVS', tone: 'success' },
  ] },
  { id: '6', label: 'Aptering', bars: [{ start: 15, end: 20, label: 'Indvendig', tone: 'primary' }] },
  { id: '7', label: 'Aflevering', bars: [{ start: 20, end: 21, label: 'Gennemgang', tone: 'warning' }] },
];

export default function GanttCanary() {
  return (
    <Screen edges={['top']} padding="none">
      <VStack gap="xs" style={{ padding: 16 }}>
        <Text variant="heading">Gantt-kanariefugl</Text>
        <Text variant="caption" color="textSecondary">
          Universalitetstest (1.7) · rul vandret og lodret
        </Text>
      </VStack>
      <GanttView rows={ROWS} days={21} todayColumn={9} />
    </Screen>
  );
}
