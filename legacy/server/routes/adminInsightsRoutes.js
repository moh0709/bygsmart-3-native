// ─────────────────────────────────────────────────────────────────────────────
// Admin insights — revenue, teams/seats, delegation, reports. All guarded by
// ensureAdmin(). Additive on top of the overview/user/company admin routes.
//
// Mounted from server/index.js via:
//   app.use(createAdminInsightsRouter({ supabaseAdmin, stripe, ensureAdmin,
//                                       parseAdminPeriod, periodDelta, countInRange,
//                                       resolveTierFromPriceId, adminLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

// GET /api/admin/revenue — MRR/ARR snapshot pulled live from Stripe, cached
// briefly server-side so repeated dashboard loads don't hammer the Stripe API.
// Module-level so the cache persists across requests for the life of the process.
let revenueCache = { data: null, key: null, expiresAt: 0 };

export const createAdminInsightsRouter = ({
  supabaseAdmin,
  stripe,
  ensureAdmin,
  parseAdminPeriod,
  periodDelta,
  countInRange,
  resolveTierFromPriceId,
  adminLimiter,
}) => {
  const router = Router();

  router.get('/api/admin/revenue', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    if (!stripe) {
      res.json({
        mrrOre: 0, arrOre: 0, currency: 'DKK', activeSubscriptions: 0, byTier: {},
        avgRevenuePerTeamOre: 0,
        newSubscriptions: periodDelta(0, 0), cancelledSubscriptions: periodDelta(0, 0),
        note: 'Stripe er ikke konfigureret på serveren.',
      });
      return;
    }

    const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);
    const cacheKey = `${from.toISOString()}|${to.toISOString()}|${prevFrom.toISOString()}|${prevTo.toISOString()}`;
    if (revenueCache.data && revenueCache.key === cacheKey && Date.now() < revenueCache.expiresAt) {
      res.json(revenueCache.data);
      return;
    }

    try {
      // Active subscriptions → MRR (yearly prices normalized to a monthly figure).
      let mrrOre = 0;
      let currency = 'DKK';
      const byTier = {};
      let activeSubscriptions = 0;
      let hasMore = true;
      let startingAfter;
      while (hasMore) {
        const page = await stripe.subscriptions.list({
          status: 'active',
          limit: 100,
          expand: ['data.items.data.price'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const sub of page.data) {
          activeSubscriptions += 1;
          for (const item of sub.items?.data || []) {
            const price = item.price;
            if (!price?.unit_amount) continue;
            const monthly = price.recurring?.interval === 'year' ? price.unit_amount / 12 : price.unit_amount;
            mrrOre += monthly * (item.quantity || 1);
            currency = (price.currency || currency).toUpperCase();
            const tier = resolveTierFromPriceId(price.id);
            byTier[tier] = (byTier[tier] || 0) + 1;
          }
        }
        hasMore = page.has_more;
        startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
      }
      mrrOre = Math.round(mrrOre);

      // New subscriptions in the period, via Stripe's `created` filter. Capped
      // at 100 per window like the cancellation scan below — accurate for
      // realistic period sizes, undercounts only if a single window sees >100
      // new subscriptions (see Phase 6 note above).
      // Cancelled subscriptions in the period — scanned from recently-canceled
      // subscriptions (capped at 100). A persisted billing_events table (see
      // roadmap Phase 6) would make this exact for long ranges; this is a
      // best-effort snapshot until then.
      const [newSubs, prevNewSubs, cancelled] = await Promise.all([
        stripe.subscriptions.list({
          status: 'all', limit: 100,
          created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) },
        }),
        stripe.subscriptions.list({
          status: 'all', limit: 100,
          created: { gte: Math.floor(prevFrom.getTime() / 1000), lte: Math.floor(prevTo.getTime() / 1000) },
        }),
        stripe.subscriptions.list({ status: 'canceled', limit: 100 }),
      ]);
      const inRange = (ts, start, end) => ts && ts * 1000 >= start.getTime() && ts * 1000 <= end.getTime();
      const cancelledInPeriod = cancelled.data.filter((s) => inRange(s.canceled_at, from, to)).length;
      const cancelledInPrevPeriod = cancelled.data.filter((s) => inRange(s.canceled_at, prevFrom, prevTo)).length;

      const payload = {
        mrrOre,
        arrOre: mrrOre * 12,
        currency,
        activeSubscriptions,
        byTier,
        avgRevenuePerTeamOre: activeSubscriptions > 0 ? Math.round(mrrOre / activeSubscriptions) : 0,
        newSubscriptions: periodDelta(newSubs.data.length, prevNewSubs.data.length),
        cancelledSubscriptions: periodDelta(cancelledInPeriod, cancelledInPrevPeriod),
      };
      revenueCache = { data: payload, key: cacheKey, expiresAt: Date.now() + 5 * 60 * 1000 };
      res.json(payload);
    } catch (err) {
      console.error('[api/admin/revenue] error:', err?.message);
      res.status(500).json({ error: 'Omsætningsdata kunne ikke hentes fra Stripe.' });
    }
  });

  // GET /api/admin/teams — seat utilization + org-chart payload (team → leader → seats).
  router.get('/api/admin/teams', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);

    try {
      const { data: teamRows, error: teamsErr } = await supabaseAdmin
        .from('teams')
        .select('id, name, leader_id, created_at')
        .order('created_at', { ascending: false });
      if (teamsErr) throw teamsErr;

      const teamIds = (teamRows || []).map((t) => t.id);
      const leaderIds = (teamRows || []).map((t) => t.leader_id);

      const [{ data: seatRows }, { data: leaderRows }] = await Promise.all([
        teamIds.length
          ? supabaseAdmin.from('team_seats').select('id, team_id, email, status, profile_id, created_at').in('team_id', teamIds)
          : Promise.resolve({ data: [] }),
        leaderIds.length
          ? supabaseAdmin.from('profiles').select('id, name, email').in('id', leaderIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Seats only carry an email until the invite is accepted (profile_id is
      // set on accept_team_invite/handle_new_user) — fetch name/job_title for
      // whichever seats already have a linked profile.
      const seatProfileIds = (seatRows || []).map((s) => s.profile_id).filter(Boolean);
      const { data: seatProfileRows } = seatProfileIds.length
        ? await supabaseAdmin.from('profiles').select('id, name, job_title').in('id', seatProfileIds)
        : { data: [] };
      const seatProfileMap = {};
      for (const p of seatProfileRows || []) seatProfileMap[p.id] = p;

      const leaderMap = {};
      for (const l of leaderRows || []) leaderMap[l.id] = l;

      const seatsByTeam = {};
      for (const s of seatRows || []) {
        (seatsByTeam[s.team_id] ||= []).push(s);
      }

      let activeSeats = 0;
      let pendingSeats = 0;

      const teams = (teamRows || []).map((t) => {
        const seats = seatsByTeam[t.id] || [];
        const active = seats.filter((s) => s.status === 'active').length;
        const pending = seats.filter((s) => s.status === 'pending').length;
        activeSeats += active;
        pendingSeats += pending;
        const leader = leaderMap[t.leader_id];
        return {
          id: t.id,
          name: t.name,
          leaderId: t.leader_id,
          leaderName: leader?.name || null,
          leaderEmail: leader?.email || null,
          createdAt: t.created_at,
          seats: seats.map((s) => {
            const profile = s.profile_id ? seatProfileMap[s.profile_id] : null;
            return {
              id: s.id,
              email: s.email,
              status: s.status,
              name: profile?.name || null,
              jobTitle: profile?.job_title || null,
              profileId: s.profile_id,
              createdAt: s.created_at,
            };
          }),
          activeSeatCount: active,
          pendingSeatCount: pending,
        };
      });

      const teamCount = teams.length;
      const totalSeats = activeSeats + pendingSeats;
      const [newTeamsCount, prevNewTeamsCount] = await Promise.all([
        countInRange('teams', 'created_at', from, to),
        countInRange('teams', 'created_at', prevFrom, prevTo),
      ]);

      res.json({
        teams,
        totals: {
          teamCount,
          activeSeats,
          pendingSeats,
          avgSeatsPerTeam: teamCount > 0 ? Math.round((totalSeats / teamCount) * 10) / 10 : 0,
          utilizationPct: totalSeats > 0 ? Math.round((activeSeats / totalSeats) * 1000) / 10 : 0,
        },
        period: { newTeams: periodDelta(newTeamsCount, prevNewTeamsCount) },
      });
    } catch (err) {
      console.error('[api/admin/teams] error:', err?.message);
      res.status(500).json({ error: 'Team- og sædedata kunne ikke hentes.' });
    }
  });

  // GET /api/admin/delegation — subcontractor ("underleverandør") relationships and delegated tasks.
  router.get('/api/admin/delegation', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);

    try {
      // Delegated tasks: resource_task_access joined to partner resources.
      // resource_task_access carries no timestamp, so "new delegations" is
      // measured via project_resources.created_at (when the partner relationship
      // was created) rather than the individual task-access rows.
      const [{ count: activeCount }, { count: pendingCount }, { data: partnerResources }] = await Promise.all([
        supabaseAdmin.from('project_resources').select('id', { count: 'exact', head: true }).eq('kind', 'partner').eq('status', 'active'),
        supabaseAdmin.from('project_resources').select('id', { count: 'exact', head: true }).eq('kind', 'partner').eq('status', 'pending'),
        supabaseAdmin.from('project_resources').select('id, created_at').eq('kind', 'partner'),
      ]);
      const partnerResourceIds = (partnerResources || []).map((r) => r.id);

      let delegatedTaskIds = [];
      if (partnerResourceIds.length) {
        const { data: accessRows } = await supabaseAdmin
          .from('resource_task_access')
          .select('task_id, resource_id')
          .in('resource_id', partnerResourceIds)
          .limit(5000);
        delegatedTaskIds = Array.from(new Set((accessRows || []).map((r) => r.task_id)));
      }

      let delegatedTasksSolved = 0;
      let delegatedTasksSolvedInPeriod = 0;
      let delegatedTasksSolvedInPrevPeriod = 0;
      if (delegatedTaskIds.length) {
        const { data: taskRows } = await supabaseAdmin
          .from('tasks')
          .select('id, status, completed_at')
          .in('id', delegatedTaskIds);
        for (const t of taskRows || []) {
          if (t.status !== 'Udført') continue;
          delegatedTasksSolved += 1;
          if (t.completed_at) {
            const ts = new Date(t.completed_at).getTime();
            if (ts >= from.getTime() && ts <= to.getTime()) delegatedTasksSolvedInPeriod += 1;
            if (ts >= prevFrom.getTime() && ts <= prevTo.getTime()) delegatedTasksSolvedInPrevPeriod += 1;
          }
        }
      }

      const newDelegations = partnerResources
        ? partnerResources.filter((r) => { const ts = new Date(r.created_at).getTime(); return ts >= from.getTime() && ts <= to.getTime(); }).length
        : 0;
      const prevNewDelegations = partnerResources
        ? partnerResources.filter((r) => { const ts = new Date(r.created_at).getTime(); return ts >= prevFrom.getTime() && ts <= prevTo.getTime(); }).length
        : 0;

      res.json({
        activeSubcontractors: activeCount ?? 0,
        pendingSubcontractors: pendingCount ?? 0,
        delegatedTasks: delegatedTaskIds.length,
        delegatedTasksSolved,
        period: {
          newDelegations: periodDelta(newDelegations, prevNewDelegations),
          delegatedTasksSolved: periodDelta(delegatedTasksSolvedInPeriod, delegatedTasksSolvedInPrevPeriod),
        },
      });
    } catch (err) {
      console.error('[api/admin/delegation] error:', err?.message);
      res.status(500).json({ error: 'Data om underleverandører kunne ikke hentes.' });
    }
  });

  // GET /api/admin/reports — handover report counts, unified across all three sources.
  // See supabase/migrations/<phase4>_ai_handover_reports_log.sql — the
  // ai_handover_reports_log table doesn't exist until that migration is applied,
  // so that count degrades to 0 (not an error) until then.
  router.get('/api/admin/reports', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);

    try {
      const [{ count: submittedCount }, { count: acceptedCount }, { count: rejectedCount }, { count: terminationCount }] = await Promise.all([
        supabaseAdmin.from('task_handovers').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('task_handovers').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
        supabaseAdmin.from('task_handovers').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabaseAdmin.from('member_terminations').select('id', { count: 'exact', head: true }),
      ]);

      let aiHandoverCount = 0;
      let aiHandoverInPeriod = 0;
      let aiHandoverInPrevPeriod = 0;
      try {
        const [{ count }, periodCount, prevPeriodCount] = await Promise.all([
          supabaseAdmin.from('ai_handover_reports_log').select('id', { count: 'exact', head: true }),
          countInRange('ai_handover_reports_log', 'generated_at', from, to),
          countInRange('ai_handover_reports_log', 'generated_at', prevFrom, prevTo),
        ]);
        aiHandoverCount = count ?? 0;
        aiHandoverInPeriod = periodCount;
        aiHandoverInPrevPeriod = prevPeriodCount;
      } catch {
        // Table not migrated yet — leave at 0.
      }

      const [taskHandoverInPeriod, taskHandoverInPrevPeriod, terminationInPeriod, terminationInPrevPeriod] = await Promise.all([
        countInRange('task_handovers', 'created_at', from, to),
        countInRange('task_handovers', 'created_at', prevFrom, prevTo),
        countInRange('member_terminations', 'created_at', from, to),
        countInRange('member_terminations', 'created_at', prevFrom, prevTo),
      ]);

      const totalReportsInPeriod = taskHandoverInPeriod + terminationInPeriod + aiHandoverInPeriod;
      const totalReportsInPrevPeriod = taskHandoverInPrevPeriod + terminationInPrevPeriod + aiHandoverInPrevPeriod;

      res.json({
        taskHandovers: { submitted: submittedCount ?? 0, accepted: acceptedCount ?? 0, rejected: rejectedCount ?? 0 },
        terminationReports: terminationCount ?? 0,
        aiHandoverReports: aiHandoverCount,
        totalReports: (submittedCount ?? 0) + (terminationCount ?? 0) + aiHandoverCount,
        period: { totalReports: periodDelta(totalReportsInPeriod, totalReportsInPrevPeriod) },
      });
    } catch (err) {
      console.error('[api/admin/reports] error:', err?.message);
      res.status(500).json({ error: 'Rapportdata kunne ikke hentes.' });
    }
  });

  return router;
};
