// @vitest-environment jsdom
// TEMPORARY runtime smoke test — renders the real calculator page components in a
// DOM, verifies no render crash, and that changing an input recomputes the results.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

// Mock only the network/auth-boundary hooks so the real page code runs offline.
vi.mock('../../../../contexts/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }));
vi.mock('../../../../contexts/ToolAccessProvider', () => ({ useToolAccess: () => ({ allowed: true, advancedAllowed: true }) }));
vi.mock('../../../../contexts/SubscriptionContext', () => ({ useSubscription: () => ({ tier: 'FREE', upgradeTo: async () => {} }) }));

import EvChargerCalculator from '../El/EvChargerCalculator';
import RetainingWallCalculator from '../StatiskeBeregninger/RetainingWallCalculator';
import SoakawayCalculator from '../Udenomsarealer/SoakawayCalculator';
import SpiralStairCalculator from '../Trapper/SpiralStairCalculator';
import WindowAcousticsCalculator from '../DoereVinduer/WindowAcousticsCalculator';
import ColumnLoadCalculator from '../StatiskeBeregninger/ColumnLoadCalculator';
import BeamLoadCalculator from '../StatiskeBeregninger/BeamLoadCalculator';

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const digits = (el: HTMLElement) => (el.textContent || '').replace(/[^0-9]/g, '');

// Change input #idx to newValue and assert the page's numeric content recomputed.
const expectReactive = (container: HTMLElement, idx: number, newValue: string) => {
  const inputs = container.querySelectorAll('input');
  expect(inputs.length).toBeGreaterThan(idx);
  const before = digits(container);
  fireEvent.change(inputs[idx], { target: { value: newValue } });
  const after = digits(container);
  expect(after).not.toBe(before); // results recomputed
};

describe('Calculator pages — runtime render + reactivity', () => {
  test('EV-charger: renders + accepts power input (outputs via AnimatedNumber)', () => {
    renderPage(<EvChargerCalculator />);
    expect(screen.getAllByText(/Ladestander/i).length).toBeGreaterThan(0);
    // Outputs here render through AnimatedNumber (async rAF), so assert state reactivity
    // on the input itself; the math is covered by the computeEvCharger unit tests.
    const input = screen.getByDisplayValue('11');
    fireEvent.change(input, { target: { value: '22' } });
    expect((input as HTMLInputElement).value).toBe('22');
    expect(screen.getAllByText(/HPFI/i).length).toBeGreaterThan(0); // still rendered, no crash
  });

  test('Retaining wall: renders + reacts to height', () => {
    const { container } = renderPage(<RetainingWallCalculator />);
    expect(screen.getAllByText(/Støttemur/i).length).toBeGreaterThan(0);
    expectReactive(container, 0, '4');
  });

  test('Soakaway: renders + reacts to catchment area', () => {
    const { container } = renderPage(<SoakawayCalculator />);
    expect(screen.getAllByText(/Faskine/i).length).toBeGreaterThan(0);
    expectReactive(container, 0, '300');
  });

  test('Spiral stair: renders + reacts to rise', () => {
    const { container } = renderPage(<SpiralStairCalculator />);
    expect(screen.getAllByText(/Vindeltrappe/i).length).toBeGreaterThan(0);
    expectReactive(container, 0, '3.6');
  });

  test('Window acoustics: renders with a Rw value', () => {
    renderPage(<WindowAcousticsCalculator />);
    expect(screen.getAllByText(/dB/i).length).toBeGreaterThan(0);
  });

  test('ColumnLoad (upgraded): renders + reacts to a dimension', () => {
    const { container } = renderPage(<ColumnLoadCalculator />);
    expect(screen.getAllByText(/Søjlebelastning/i).length).toBeGreaterThan(0);
    expectReactive(container, 0, '5');
  });

  test('BeamLoad (upgraded): renders + reacts to a dimension', () => {
    const { container } = renderPage(<BeamLoadCalculator />);
    expect(screen.getAllByText(/Bjælke/i).length).toBeGreaterThan(0);
    expectReactive(container, 0, '7');
  });
});
