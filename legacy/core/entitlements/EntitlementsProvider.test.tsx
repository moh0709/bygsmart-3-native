import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EntitlementsProvider, useModuleEnabled, useEntitlements } from './EntitlementsProvider';

const mocks = vi.hoisted(() => {
  const channelChain = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channelChain.on.mockReturnValue(channelChain);
  channelChain.subscribe.mockReturnValue(channelChain);
  return {
    useAuth: vi.fn(),
    useOrg: vi.fn(),
    getModuleEntitlements: vi.fn(),
    listHiddenModules: vi.fn(),
    channelChain,
    channel: vi.fn(() => channelChain),
    removeChannel: vi.fn(),
  };
});

vi.mock('../../contexts/AuthProvider', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('../org/OrgProvider', () => ({
  useOrg: mocks.useOrg,
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: { channel: mocks.channel, removeChannel: mocks.removeChannel },
}));

vi.mock('../../services/moduleEntitlements', () => ({
  getModuleEntitlements: mocks.getModuleEntitlements,
}));

vi.mock('../../services/orgModulePrefs', () => ({
  listHiddenModules: mocks.listHiddenModules,
}));

const Probe: React.FC = () => {
  const budgetOn = useModuleEnabled('budget');
  const { meta, getEntitlement } = useEntitlements();
  return (
    <div>
      <span data-testid="budget">{budgetOn ? 'on' : 'off'}</span>
      <span data-testid="budget-entitled">{getEntitlement('budget').enabled ? 'yes' : 'no'}</span>
      <span data-testid="source">{meta?.source ?? 'none'}</span>
    </div>
  );
};

const renderProbe = () =>
  render(
    <EntitlementsProvider>
      <Probe />
    </EntitlementsProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.channel.mockReturnValue(mocks.channelChain);
  mocks.channelChain.on.mockReturnValue(mocks.channelChain);
  mocks.channelChain.subscribe.mockReturnValue(mocks.channelChain);
  mocks.useAuth.mockReturnValue({ isAuthenticated: true });
  mocks.useOrg.mockReturnValue({ activeOrg: null });
  mocks.listHiddenModules.mockResolvedValue([]);
});

describe('EntitlementsProvider', () => {
  it('fails open when the resolver errors — every module counts as enabled', async () => {
    mocks.getModuleEntitlements.mockRejectedValue(new Error('500'));
    renderProbe();
    await waitFor(() => expect(mocks.getModuleEntitlements).toHaveBeenCalled());
    expect(screen.getByTestId('budget').textContent).toBe('on');
    expect(screen.getByTestId('source').textContent).toBe('none');
  });

  it('fails open while unauthenticated (no fetch at all)', () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false });
    renderProbe();
    expect(mocks.getModuleEntitlements).not.toHaveBeenCalled();
    expect(screen.getByTestId('budget').textContent).toBe('on');
  });

  it('respects a server-resolved disabled module', async () => {
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: null,
      grandfathered: false,
      source: 'db',
      modules: { budget: { enabled: false, source: 'admin', validUntil: null } },
    });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('budget').textContent).toBe('off'));
    expect(screen.getByTestId('source').textContent).toBe('db');
  });

  it('unknown modules in the map fail open', async () => {
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: null,
      grandfathered: false,
      source: 'tier-map',
      modules: { time: { enabled: true, source: 'tier', validUntil: null } },
    });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('tier-map'));
    // budget wasn't in the response at all → fail-open
    expect(screen.getByTestId('budget').textContent).toBe('on');
  });

  it('subscribes to realtime entitlement flips for the active org', async () => {
    mocks.useOrg.mockReturnValue({ activeOrg: { id: 'org-1', name: 'Alpha' } });
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: 'org-1',
      grandfathered: false,
      source: 'db',
      modules: { budget: { enabled: false, source: 'admin', validUntil: null } },
    });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('budget').textContent).toBe('off'));
    expect(mocks.channel).toHaveBeenCalledWith('org-entitlements:org-1');
    expect(mocks.channelChain.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'org_module_entitlements', filter: 'org_id=eq.org-1' }),
      expect.any(Function)
    );

    // A realtime event triggers a refetch with the new state.
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: 'org-1',
      grandfathered: false,
      source: 'db',
      modules: { budget: { enabled: true, source: 'purchase', validUntil: null } },
    });
    const realtimeCallback = mocks.channelChain.on.mock.calls[0][2];
    realtimeCallback();
    await waitFor(() => expect(screen.getByTestId('budget').textContent).toBe('on'));
  });

  it('subtracts an owner-deactivated module from gating but keeps its billing entry', async () => {
    mocks.useOrg.mockReturnValue({ activeOrg: { id: 'org-1', name: 'Alpha', createdBy: 'u1' } });
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: 'org-1',
      grandfathered: false,
      source: 'db',
      modules: { budget: { enabled: true, source: 'purchase', validUntil: null } },
    });
    mocks.listHiddenModules.mockResolvedValue(['budget']);
    renderProbe();
    // Gating hides it…
    await waitFor(() => expect(screen.getByTestId('budget').textContent).toBe('off'));
    // …but the billing truth stays intact (getEntitlement unaffected).
    expect(screen.getByTestId('budget-entitled').textContent).toBe('yes');
  });

  it('fail-safe: a missing prefs table (empty hidden set) hides nothing', async () => {
    mocks.useOrg.mockReturnValue({ activeOrg: { id: 'org-1', name: 'Alpha', createdBy: 'u1' } });
    mocks.getModuleEntitlements.mockResolvedValue({
      orgId: 'org-1',
      grandfathered: false,
      source: 'db',
      modules: { budget: { enabled: true, source: 'purchase', validUntil: null } },
    });
    mocks.listHiddenModules.mockResolvedValue([]); // service already swallows 42P01 → []
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('db'));
    expect(screen.getByTestId('budget').textContent).toBe('on');
  });
});
