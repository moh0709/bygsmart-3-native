import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

class ThrowingComponent extends React.Component {
  render() {
    throw new Error('boom');
    return null;
  }
}

describe('ErrorBoundary', () => {
  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Noget gik galt')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('supports custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders reset button in fallback state', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    const button = screen.getByRole('button', { name: /Ga til forsiden/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    spy.mockRestore();
  });
});
