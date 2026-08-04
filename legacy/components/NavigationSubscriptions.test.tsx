import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomNavBar, { useProjectUnread } from './BottomNavBar';
import NavRail from './NavRail';

const realtime = vi.hoisted(() => {
  const state = { subscribed: false };
  const channel = {
    on: vi.fn(() => {
      if (state.subscribed) {
        throw new Error(
          'cannot add `postgres_changes` callbacks for realtime:bottom-nav:notifications after `subscribe()`.'
        );
      }
      return channel;
    }),
    subscribe: vi.fn(() => {
      state.subscribed = true;
      return channel;
    }),
  };

  return {
    state,
    channel,
    createChannel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
});

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    channel: realtime.createChannel,
    removeChannel: realtime.removeChannel,
  },
}));

vi.mock('../services/api', () => ({
  getTotalUnreadProjectNotifications: vi.fn(() => new Promise<number>(() => {})),
}));

vi.mock('../contexts/AuthProvider', () => ({
  useAuth: () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ transparentMenu: false }),
}));

const NavigationSurfaces: React.FC = () => {
  const projectUnread = useProjectUnread();

  return (
    <>
      <NavRail projectUnread={projectUnread} />
      <BottomNavBar projectUnread={projectUnread} />
    </>
  );
};

describe('navigation unread subscription', () => {
  beforeEach(() => {
    realtime.state.subscribed = false;
    realtime.createChannel.mockClear();
    realtime.channel.on.mockClear();
    realtime.channel.subscribe.mockClear();
    realtime.removeChannel.mockClear();
  });

  it('shares one realtime subscription across both navigation surfaces', () => {
    expect(() => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NavigationSurfaces />
        </MemoryRouter>
      );
    }).not.toThrow();

    expect(realtime.createChannel).toHaveBeenCalledTimes(1);
  });
});
