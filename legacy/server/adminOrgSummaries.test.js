import { describe, expect, test } from 'vitest';
import { buildOrgSummaries, buildOrgTotals } from './routes/adminOrgRoutes.js';

const profiles = [
  { id: 'u-owner', name: 'Mette Bak', email: 'mette@firma.dk', username: 'mette', is_demo: false, demo_contact_email: null, subscription_tier: 'PRO' },
  { id: 'u-member', name: 'Anders And', email: 'anders@firma.dk', username: 'anders', is_demo: false, demo_contact_email: null, subscription_tier: 'FREE' },
  { id: 'u-demo', name: 'Demo Bruger', email: 'demo+abc@demo.bygsmart.dk', username: 'demo_abc', is_demo: true, demo_contact_email: 'visitor@example.com', subscription_tier: 'FREE' },
];

const orgRows = [
  { id: 'org-1', name: 'Byggefirma A/S', cvr: '12345678', address: 'Vej 1', grandfathered: true, storage_allowance_gb: 5, created_by: 'u-owner', created_at: '2026-07-01T00:00:00Z' },
  { id: 'org-2', name: 'Demo Brugers organisation', cvr: null, address: null, grandfathered: false, storage_allowance_gb: 5, created_by: 'u-demo', created_at: '2026-07-20T00:00:00Z' },
];

const memberRows = [
  { org_id: 'org-1', user_id: 'u-member', invite_email: null, role: 'member', status: 'active', created_at: '2026-07-02T00:00:00Z' },
  { org_id: 'org-1', user_id: 'u-owner', invite_email: null, role: 'owner', status: 'active', created_at: '2026-07-01T00:00:00Z' },
  { org_id: 'org-1', user_id: null, invite_email: 'ny@firma.dk', role: 'member', status: 'pending', created_at: '2026-07-05T00:00:00Z' },
  { org_id: 'org-2', user_id: 'u-demo', invite_email: null, role: 'owner', status: 'active', created_at: '2026-07-20T00:00:00Z' },
];

const projectRows = [{ org_id: 'org-1' }, { org_id: 'org-1' }, { org_id: 'org-2' }, { org_id: null }];

describe('admin organisation summaries', () => {
  const summaries = buildOrgSummaries({ orgRows, memberRows, projectRows, profileRows: profiles });
  const [org1, org2] = summaries;

  test('resolves the owner from the owner membership', () => {
    expect(org1.ownerId).toBe('u-owner');
    expect(org1.ownerName).toBe('Mette Bak');
    expect(org1.ownerTier).toBe('PRO');
  });

  test('counts only active members, and pending invites separately', () => {
    expect(org1.memberCount).toBe(2);
    expect(org1.pendingInviteCount).toBe(1);
  });

  test('counts projects per organisation and ignores orphans', () => {
    expect(org1.projectCount).toBe(2);
    expect(org2.projectCount).toBe(1);
  });

  test('flags an organisation as demo when its owner is a demo account', () => {
    expect(org1.isDemo).toBe(false);
    expect(org2.isDemo).toBe(true);
    // The visitor's real e-mail, not the generated demo+…@ login address.
    expect(org2.demoContactEmail).toBe('visitor@example.com');
  });

  test('lists the owner first, then members alphabetically', () => {
    expect(org1.members.map((m) => m.name)).toEqual(['Mette Bak', 'Anders And']);
    expect(org1.members[0].role).toBe('owner');
  });

  test('falls back to created_by when no owner membership exists', () => {
    const [orphan] = buildOrgSummaries({
      orgRows: [orgRows[0]],
      memberRows: [],
      projectRows: [],
      profileRows: profiles,
    });
    expect(orphan.ownerId).toBe('u-owner');
    expect(orphan.memberCount).toBe(0);
  });

  test('rolls up totals across organisations', () => {
    const totals = buildOrgTotals(summaries);
    expect(totals).toMatchObject({
      orgCount: 2,
      demoOrgCount: 1,
      grandfatheredCount: 1,
      pendingInvites: 1,
      avgMembersPerOrg: 1.5,
      truncated: false,
    });
  });
});
