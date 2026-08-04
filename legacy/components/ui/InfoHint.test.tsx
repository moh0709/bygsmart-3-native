// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { InfoHint } from './InfoHint';

const DESCRIPTION = 'Sandsynligheden for at projektet afsluttes inden deadline.';
const CALCULATION = 'SPI = færdiggjort arbejde ÷ forløben tid';

const renderHint = (props: Partial<React.ComponentProps<typeof InfoHint>> = {}) =>
  render(
    <InfoHint
      title="On-time sandsynlighed"
      description={DESCRIPTION}
      calculation={CALCULATION}
      {...props}
    />
  );

describe('InfoHint', () => {
  test('renders a collapsed, accessible trigger button', () => {
    renderHint();
    const trigger = screen.getByRole('button', { name: 'Mere info' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hvad viser den?')).not.toBeInTheDocument();
  });

  test('opens on click and closes again on a second click', () => {
    renderHint();
    const trigger = screen.getByRole('button', { name: 'Mere info' });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hvad viser den?')).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hvad viser den?')).not.toBeInTheDocument();
  });

  test('shows the optional calculation section when provided', () => {
    renderHint();
    fireEvent.click(screen.getByRole('button', { name: 'Mere info' }));
    expect(screen.getByText('Hvordan måles det?')).toBeInTheDocument();
    expect(screen.getByText(CALCULATION)).toBeInTheDocument();
  });

  test('omits the calculation section when not provided', () => {
    renderHint({ calculation: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Mere info' }));
    expect(screen.getByText('Hvad viser den?')).toBeInTheDocument();
    expect(screen.queryByText('Hvordan måles det?')).not.toBeInTheDocument();
  });

  test('closes on Escape', () => {
    renderHint();
    const trigger = screen.getByRole('button', { name: 'Mere info' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hvad viser den?')).not.toBeInTheDocument();
  });

  test('closes via the dedicated close button', () => {
    renderHint();
    fireEvent.click(screen.getByRole('button', { name: 'Mere info' }));
    fireEvent.click(screen.getByRole('button', { name: 'Luk' }));
    expect(screen.getByRole('button', { name: 'Mere info' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('uses a custom accessible label when supplied', () => {
    renderHint({ label: 'Om on-time sandsynlighed' });
    expect(screen.getByRole('button', { name: 'Om on-time sandsynlighed' })).toBeInTheDocument();
  });
});
