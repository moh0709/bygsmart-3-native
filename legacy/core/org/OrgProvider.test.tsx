import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { OrgProvider, useOrg } from './OrgProvider';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  listMyOrganizations: vi.fn(),
  getActiveOrgId: vi.fn(),
  switchActiveOrg: vi.fn(),
}));

vi.mock('../../contexts/AuthProvider', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('../../services/organizations', () => ({
  listMyOrganizations: mocks.listMyOrganizations,
  getActiveOrgId: mocks.getActiveOrgId,
  switchActiveOrg: mocks.switchActiveOrg,
  getOrgStorageUsage: vi.fn(() => Promise.resolve(null)),
}));

const org = (id: string, name: string) => ({
  id, name, cvr: null, logoUrl: null, grandfathered: true,
  storageAllowanceGb: 5, sourceTeamId: null, createdBy: 'u1',
});

const Probe: React.FC = () => {
  const { activeOrg, memberships, switchOrg } = useOrg();
  return (
    <div>
      <span data-testid="active">{activeOrg?.name ?? 'none'}</span>
      <span data-testid="count">{memberships.length}</span>
      <button onClick={() => switchOrg('org-b')}>switch</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <OrgProvider>
      <Probe />
    </OrgProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuth.mockReturnValue({ isAuthenticated: true });
  mocks.switchActiveOrg.mockResolvedValue(undefined);
});

describe('OrgProvider', () => {
  it('resolves memberships and the active org', async () => {
    mocks.listMyOrganizations.mockResolvedValue([
      { role: 'owner', status: 'active', org: org('org-a', 'Alpha ApS') },
      { role: 'member', status: 'active', org: org('org-b', 'Beta ApS') },
    ]);
    mocks.getActiveOrgId.mockResolvedValue('org-b');
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('Beta ApS'));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('falls back to the first active membership when active_org_id is stale', async () => {
    mocks.listMyOrganizations.mockResolvedValue([
      { role: 'owner', status: 'active', org: org('org-a', 'Alpha ApS') },
    ]);
    mocks.getActiveOrgId.mockResolvedValue('org-deleted');
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('Alpha ApS'));
  });

  it('fails soft on service errors — empty memberships, no active org', async () => {
    mocks.listMyOrganizations.mockRejectedValue(new Error('boom'));
    mocks.getActiveOrgId.mockResolvedValue(null);
    renderProbe();
    await waitFor(() => expect(mocks.listMyOrganizations).toHaveBeenCalled());
    expect(screen.getByTestId('active').textContent).toBe('none');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('switchOrg validates via the RPC then updates local state', async () => {
    mocks.listMyOrganizations.mockResolvedValue([
      { role: 'owner', status: 'active', org: org('org-a', 'Alpha ApS') },
      { role: 'member', status: 'active', org: org('org-b', 'Beta ApS') },
    ]);
    mocks.getActiveOrgId.mockResolvedValue('org-a');
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('Alpha ApS'));
    await act(async () => {
      screen.getByText('switch').click();
    });
    expect(mocks.switchActiveOrg).toHaveBeenCalledWith('org-b');
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('Beta ApS'));
  });

  it('does not fetch while unauthenticated', () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false });
    renderProbe();
    expect(mocks.listMyOrganizations).not.toHaveBeenCalled();
  });
});
