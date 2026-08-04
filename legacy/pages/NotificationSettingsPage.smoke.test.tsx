// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

// Mock the network/auth boundary so the page runs offline.
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }));
vi.mock('../services/notificationPreferences', () => ({
  // Empty map → the page falls back to its default-ON baseline per event.
  loadNotificationPreferences: vi.fn().mockResolvedValue({}),
  saveNotificationPreference: vi.fn().mockResolvedValue(undefined),
}));

import NotificationSettingsPage from './NotificationSettingsPage';
import { saveNotificationPreference } from '../services/notificationPreferences';

test('renders grouped events + persists a toggle change', async () => {
  render(
    <MemoryRouter>
      <NotificationSettingsPage />
    </MemoryRouter>,
  );

  // Loads → a known event label and its category heading appear.
  expect((await screen.findAllByText(/Tilføjet til et team/i)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Projekter & opgaver/i).length).toBeGreaterThan(0);

  // Toggling a switch persists the change.
  const switches = screen.getAllByRole('switch');
  expect(switches.length).toBeGreaterThan(0);
  fireEvent.click(switches[0]);
  await waitFor(() => expect(saveNotificationPreference).toHaveBeenCalled());
});
