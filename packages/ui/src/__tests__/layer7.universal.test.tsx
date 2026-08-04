// TEST LAYER 7 — universal component, WEB-RENDERER arm (via react-native-web + jsdom).
// Proves primitives render on the web renderer. Native-renderer arm is a P1 follow-up.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Text } from '../primitives/Text';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { EmptyState } from '../primitives/EmptyState';

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
    const el = screen.getByText('Gem');
    expect(el).toBeTruthy();
  });

  it('EmptyState shows title + description', () => {
    render(<EmptyState title="Ingen opgaver" description="Opret din første opgave" />);
    expect(screen.getByText('Ingen opgaver')).toBeTruthy();
    expect(screen.getByText('Opret din første opgave')).toBeTruthy();
  });
});
