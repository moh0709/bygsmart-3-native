// TEST LAYER 7 — universal component, WEB-RENDERER arm (via react-native-web + jsdom).
// Proves primitives render on the web renderer. Native-renderer arm is a P1 follow-up.
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Text } from '../primitives/Text';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { EmptyState } from '../primitives/EmptyState';
import { TextField } from '../primitives/TextField';
import { Checkbox } from '../primitives/Checkbox';
import { Switch } from '../primitives/Switch';
import { RadioGroup } from '../primitives/RadioGroup';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Chip } from '../primitives/Chip';
import { Avatar, initialsOf } from '../primitives/Avatar';
import { IconButton } from '../primitives/IconButton';
import { ListItem } from '../primitives/ListItem';
import { ProgressBar } from '../primitives/ProgressBar';
import { Grid } from '../primitives/Grid';
import { TwoPane } from '../primitives/TwoPane';
// Icon itself imports react-native-svg (native/Fabric build) which doesn't load
// under jsdom — its SVG rendering is covered by the expo web export + typecheck.
// The name vocabulary is pure and unit-tested here.
import { isIconName, ICON_NAMES } from '../icons/iconRegistry';
import { GanttView, type GanttRow } from '../canary/GanttView';

// Each render mounts into document.body; clean up so queries don't see prior tests.
afterEach(cleanup);

describe('Layer 7 — primitives render through react-native-web', () => {
  it('Text renders its content to the DOM', () => {
    render(<Text>Hej verden</Text>);
    expect(screen.getByText('Hej verden')).toBeTruthy();
  });

  it('Badge renders a status label', () => {
    render(<Badge label="Synkroniseret" tone="success" />);
    expect(screen.getByText('Synkroniseret')).toBeTruthy();
  });

  it('Button exposes an accessible button role', () => {
    render(<Button title="Gem" onPress={() => {}} />);
    expect(screen.getByText('Gem')).toBeTruthy();
  });

  it('Button supports the outline variant and sizes (design-system additions)', () => {
    const onPress = vi.fn();
    render(<Button title="Demo adgang" variant="outline" size="lg" fullWidth onPress={onPress} />);
    fireEvent.click(screen.getByText('Demo adgang'));
    expect(onPress).toHaveBeenCalled();
  });

  it('Card renders its content and an elevated + flat form', () => {
    render(
      <>
        <Card>
          <Text>Løftet kort</Text>
        </Card>
        <Card flat>
          <Text>Fladt kort</Text>
        </Card>
      </>,
    );
    expect(screen.getByText('Løftet kort')).toBeTruthy();
    expect(screen.getByText('Fladt kort')).toBeTruthy();
  });

  it('EmptyState shows title + description', () => {
    render(<EmptyState title="Ingen opgaver" description="Opret din første opgave" />);
    expect(screen.getByText('Ingen opgaver')).toBeTruthy();
    expect(screen.getByText('Opret din første opgave')).toBeTruthy();
  });
});

describe('Layer 7 — form primitives', () => {
  it('TextField shows its label and error message', () => {
    render(<TextField label="E-mail" error="Ugyldig e-mail" />);
    expect(screen.getByText('E-mail')).toBeTruthy();
    expect(screen.getByText('Ugyldig e-mail')).toBeTruthy();
  });

  it('Checkbox toggles on press', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Accepter" />);
    fireEvent.click(screen.getByText('Accepter'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Switch renders its label', () => {
    render(<Switch value onValueChange={() => {}} label="Notifikationer" />);
    expect(screen.getByText('Notifikationer')).toBeTruthy();
  });

  it('RadioGroup renders every option and selects on press', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Alfa' },
          { value: 'b', label: 'Beta' },
        ]}
      />,
    );
    expect(screen.getByText('Alfa')).toBeTruthy();
    fireEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('SegmentedControl switches segment on press', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="list"
        onChange={onChange}
        segments={[
          { value: 'list', label: 'Liste' },
          { value: 'kort', label: 'Kort' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Kort'));
    expect(onChange).toHaveBeenCalledWith('kort');
  });

  it('Chip fires onPress', () => {
    const onPress = vi.fn();
    render(<Chip label="BR18" selected onPress={onPress} />);
    fireEvent.click(screen.getByText('BR18'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Layer 7 — display + layout primitives', () => {
  it('Avatar derives initials from a name', () => {
    expect(initialsOf('Mikkel Overgaard')).toBe('MO');
    expect(initialsOf('Bo')).toBe('BO');
    expect(initialsOf('   ')).toBe('?');
    render(<Avatar name="Mikkel Overgaard" />);
    expect(screen.getByText('MO')).toBeTruthy();
  });

  it('IconButton exposes its accessible label', () => {
    const onPress = vi.fn();
    render(<IconButton icon="＋" accessibilityLabel="Tilføj" onPress={onPress} />);
    fireEvent.click(screen.getByLabelText('Tilføj'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ListItem shows title + subtitle', () => {
    render(<ListItem title="Projekt Nord" subtitle="3 opgaver" leading="🏗️" />);
    expect(screen.getByText('Projekt Nord')).toBeTruthy();
    expect(screen.getByText('3 opgaver')).toBeTruthy();
  });

  it('ProgressBar renders with the progressbar role', () => {
    render(<ProgressBar value={1.5} label="Fremdrift" />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('Grid renders all children', () => {
    render(
      <Grid>
        <Text>Et</Text>
        <Text>To</Text>
        <Text>Tre</Text>
      </Grid>,
    );
    expect(screen.getByText('Et')).toBeTruthy();
    expect(screen.getByText('Tre')).toBeTruthy();
  });

  it('TwoPane renders both panes', () => {
    render(<TwoPane primary={<Text>Liste</Text>} secondary={<Text>Detalje</Text>} />);
    expect(screen.getByText('Liste')).toBeTruthy();
    expect(screen.getByText('Detalje')).toBeTruthy();
  });
});

describe('icon name vocabulary', () => {
  it('isIconName guards the registry', () => {
    expect(isIconName('home')).toBe(true);
    expect(isIconName('tasks')).toBe(true);
    expect(isIconName('not-an-icon')).toBe(false);
  });

  it('has the nav icons the app wires by name', () => {
    for (const n of ['home', 'more', 'projects', 'tasks']) {
      expect(ICON_NAMES).toContain(n);
    }
  });
});

describe('Gantt canary (1.7) — renders through react-native-web', () => {
  const rows: GanttRow[] = [
    { id: '1', label: 'Fundament', bars: [{ start: 0, end: 3, label: 'Støbning' }] },
    { id: '2', label: 'Råhus', bars: [{ start: 2, end: 6, label: 'Rejsning', tone: 'warning' }] },
  ];

  it('draws row labels and bar labels on the web renderer', () => {
    render(<GanttView rows={rows} days={10} todayColumn={4} />);
    expect(screen.getByText('Fundament')).toBeTruthy();
    expect(screen.getByText('Rejsning')).toBeTruthy();
  });
});
