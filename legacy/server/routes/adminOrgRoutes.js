// ─────────────────────────────────────────────────────────────────────────────
// Admin organisations — the company view of the platform. Replaces the
// companies-table routes retired in W7e; organizations are the company concept
// now (see supabase/migrations/20260716000001_retire_companies_table.sql).
//
// Mounted from server/index.js via:
//   app.use(createAdminOrgRouter({ supabaseAdmin, ensureAdmin, parseAdminPeriod,
//                                  periodDelta, countInRange, adminLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

// Mirrors the user list cap in adminOverviewRoutes — the dashboard filters
// client-side, so an unbounded fetch would only grow the payload.
export const ORG_LIMIT = 200;

/**
 * Joins the four raw result sets into the per-organisation summaries the admin
 * dashboard renders. Pure so the owner-resolution and counting rules can be
 * tested without a database.
 */
export const buildOrgSummaries = ({ orgRows, memberRows, projectRows, profileRows }) => {
  const profileMap = {};
  for (const p of profileRows || []) profileMap[p.id] = p;

  const membersByOrg = {};
  for (const m of memberRows || []) (membersByOrg[m.org_id] ||= []).push(m);

  const projectCountByOrg = {};
  for (const p of projectRows || []) {
    if (p.org_id) projectCountByOrg[p.org_id] = (projectCountByOrg[p.org_id] || 0) + 1;
  }

  return (orgRows || []).map((o) => {
    const members = membersByOrg[o.id] || [];
    const activeMembers = members.filter((m) => m.status === 'active');
    // The owner is whoever holds the 'owner' membership, falling back to
    // created_by for rows predating the membership backfill.
    const ownerMembership = activeMembers.find((m) => m.role === 'owner' && m.user_id);
    const ownerProfile = profileMap[ownerMembership?.user_id] || profileMap[o.created_by] || null;

    return {
      id: o.id,
      name: o.name,
      cvr: o.cvr || null,
      address: o.address || null,
      grandfathered: !!o.grandfathered,
      storageAllowanceGb: o.storage_allowance_gb ?? 0,
      createdAt: o.created_at,
      ownerId: ownerProfile?.id || o.created_by || null,
      ownerName: ownerProfile?.name || ownerProfile?.username || null,
      ownerEmail: ownerProfile?.email || null,
      ownerTier: ownerProfile?.subscription_tier || null,
      // An organisation is a demo organisation when the person who owns it is
      // still on a demo account — there is no flag on the org itself.
      isDemo: !!ownerProfile?.is_demo,
      demoContactEmail: ownerProfile?.demo_contact_email || null,
      memberCount: activeMembers.length,
      pendingInviteCount: members.filter((m) => m.status === 'pending').length,
      projectCount: projectCountByOrg[o.id] || 0,
      members: activeMembers
        .map((m) => {
          const p = m.user_id ? profileMap[m.user_id] : null;
          return {
            userId: m.user_id || null,
            name: p?.name || p?.username || m.invite_email || '–',
            email: p?.email || m.invite_email || null,
            role: m.role,
            isDemo: !!p?.is_demo,
            joinedAt: m.created_at,
          };
        })
        // Owner first, then alphabetical — the list reads as a company card.
        .sort((a, b) => {
          if (a.role === 'owner' && b.role !== 'owner') return -1;
          if (b.role === 'owner' && a.role !== 'owner') return 1;
          return (a.name || '').localeCompare(b.name || '', 'da');
        }),
    };
  });
};

/** Roll-up shown as stat cards above the organisation list. */
export const buildOrgTotals = (organizations) => {
  const totalMembers = organizations.reduce((sum, o) => sum + o.memberCount, 0);
  return {
    orgCount: organizations.length,
    demoOrgCount: organizations.filter((o) => o.isDemo).length,
    grandfatheredCount: organizations.filter((o) => o.grandfathered).length,
    pendingInvites: organizations.reduce((sum, o) => sum + o.pendingInviteCount, 0),
    avgMembersPerOrg:
      organizations.length > 0 ? Math.round((totalMembers / organizations.length) * 10) / 10 : 0,
    truncated: organizations.length >= ORG_LIMIT,
  };
};

export const createAdminOrgRouter = ({
  supabaseAdmin,
  ensureAdmin,
  parseAdminPeriod,
  periodDelta,
  countInRange,
  adminLimiter,
}) => {
  const router = Router();

  // GET /api/admin/organizations — every organisation with its owner, member
  // counts, project count and whether it belongs to a demo visitor.
  router.get('/api/admin/organizations', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);

    try {
      const { data: orgRows, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .select('id, name, cvr, address, grandfathered, storage_allowance_gb, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(ORG_LIMIT);
      if (orgErr) throw orgErr;

      const orgIds = (orgRows || []).map((o) => o.id);

      const [{ data: memberRows }, { data: projectRows }] = await Promise.all([
        orgIds.length
          ? supabaseAdmin
              .from('organization_members')
              .select('org_id, user_id, invite_email, role, status, created_at')
              .in('org_id', orgIds)
          : Promise.resolve({ data: [] }),
        orgIds.length
          ? supabaseAdmin.from('projects').select('org_id').in('org_id', orgIds)
          : Promise.resolve({ data: [] }),
      ]);

      // One profile lookup covering both owners and members.
      const profileIds = new Set();
      for (const o of orgRows || []) if (o.created_by) profileIds.add(o.created_by);
      for (const m of memberRows || []) if (m.user_id) profileIds.add(m.user_id);

      const profileIdList = [...profileIds];
      const { data: profileRows } = profileIdList.length
        ? await supabaseAdmin
            .from('profiles')
            .select('id, name, email, username, is_demo, demo_contact_email, subscription_tier')
            .in('id', profileIdList)
        : { data: [] };

      const organizations = buildOrgSummaries({ orgRows, memberRows, projectRows, profileRows });

      const [newOrgCount, prevNewOrgCount] = await Promise.all([
        countInRange('organizations', 'created_at', from, to),
        countInRange('organizations', 'created_at', prevFrom, prevTo),
      ]);

      res.json({
        organizations,
        totals: buildOrgTotals(organizations),
        period: { newOrganizations: periodDelta(newOrgCount, prevNewOrgCount) },
      });
    } catch (err) {
      console.error('[api/admin/organizations] error:', err?.message);
      res.status(500).json({ error: 'Organisationer kunne ikke hentes.' });
    }
  });

  return router;
};
