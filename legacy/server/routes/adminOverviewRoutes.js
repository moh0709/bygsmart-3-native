// ─────────────────────────────────────────────────────────────────────────────
// Admin overview route — platform-wide metrics. Admin-only (app_role = 'admin').
//
// Mounted from server/index.js via:
//   app.use(createAdminOverviewRouter({ supabaseAdmin, getAuthenticatedUser,
//                                       getAdminProfile, parseAdminPeriod,
//                                       countInRange, periodDelta, isProduction,
//                                       adminLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

export const createAdminOverviewRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  getAdminProfile,
  parseAdminPeriod,
  countInRange,
  periodDelta,
  isProduction,
  adminLimiter,
}) => {
  const router = Router();

  // GET /api/admin/overview
  // Returns platform-wide metrics. Admin-only (app_role = 'admin').
  router.get('/api/admin/overview', adminLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    const profile = await getAdminProfile(user.id);
    if (!profile || profile.app_role !== 'admin') {
      res.status(403).json({ error: 'Adgang nægtet. Kun administratorer.' });
      return;
    }

    try {
      // Fetch aggregate counts in parallel.
      const [
        profilesResult,
        companiesResult,
        projectsResult,
        tasksResult,
        tasksSolvedResult,
        tasksOverdueResult,
      ] = await Promise.all([
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
        // companies table retired (W7e) -- organizations are the company concept now.
        supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'Udført'),
        supabaseAdmin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Forfalden'),
      ]);

      // Fetch user list. Try to enrich with last_sign_in_at from auth admin API,
      // but fall back gracefully if that call fails (e.g. plan restrictions).
      let usersList = [];
      try {
        // Build auth map — non-fatal if this fails. Carries last_sign_in_at,
        // banned_until (deactivation state) and email-confirmation status.
        let authUsersMap = {};
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
          const now = Date.now();
          for (const u of authData?.users || []) {
            const bannedUntil = u.banned_until || null;
            const isBanned = !!bannedUntil && new Date(bannedUntil).getTime() > now;
            authUsersMap[u.id] = {
              last_sign_in_at: u.last_sign_in_at || null,
              created_at: u.created_at || null,
              banned_until: bannedUntil,
              is_active: !isBanned,
              email_confirmed: !!u.email_confirmed_at,
            };
          }
        } catch (authErr) {
          console.warn('[api/admin/overview] auth.admin.listUsers failed (non-fatal):', authErr?.message);
        }

        const { data: profiles, error: profilesErr } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email, username, app_role, user_type, subscription_tier, trial_tier, trial_ends_at, company_name, team_id, team_role, job_title, phone, avatar_url, is_demo, demo_contact_email, stripe_customer_id, stripe_subscription_id, created_at')
          .order('created_at', { ascending: false })
          .limit(200);

        if (profilesErr) throw profilesErr;

        // Team-member counts — how many profiles share each team_id.
        const teamCountMap = {};
        for (const p of profiles || []) {
          if (p.team_id) teamCountMap[p.team_id] = (teamCountMap[p.team_id] || 0) + 1;
        }

        usersList = (profiles || []).map((p) => {
          const auth = authUsersMap[p.id] || {};
          const tier = p.subscription_tier ?? 'FREE';
          const isTrialActive = !!p.trial_tier && !!p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now();
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            username: p.username,
            appRole: p.app_role,
            userType: p.user_type ?? 'normal',
            subscriptionTier: tier,
            isPaid: tier !== 'FREE',
            trialTier: isTrialActive ? p.trial_tier : null,
            trialEndsAt: isTrialActive ? p.trial_ends_at : null,
            isTrialActive,
            companyName: p.company_name || null,
            teamId: p.team_id,
            teamRole: p.team_role,
            teamCount: p.team_id ? (teamCountMap[p.team_id] || 1) : 0,
            jobTitle: p.job_title,
            phone: p.phone,
            avatarUrl: p.avatar_url,
            isDemo: !!p.is_demo,
            // The e-mail the demo visitor typed on the login screen — the real
            // contact behind the generated demo+…@ login address.
            demoContactEmail: p.demo_contact_email || null,
            hasBilling: !!p.stripe_customer_id,
            createdAt: p.created_at || auth.created_at || null,
            lastSignInAt: auth.last_sign_in_at || null,
            isActive: auth.is_active !== false,
            bannedUntil: auth.banned_until || null,
            emailConfirmed: auth.email_confirmed ?? null,
            sessionCount: auth.last_sign_in_at ? 1 : 0,
          };
        });

        // Sort by lastSignInAt descending; users who never signed in go last.
        usersList.sort((a, b) => {
          if (!a.lastSignInAt && !b.lastSignInAt) return 0;
          if (!a.lastSignInAt) return 1;
          if (!b.lastSignInAt) return -1;
          return new Date(b.lastSignInAt).getTime() - new Date(a.lastSignInAt).getTime();
        });
      } catch (userListErr) {
        console.error('[api/admin/overview] user list error:', userListErr?.message);
      }

      // Period-scoped deltas (defaults to month-to-date vs. the preceding period —
      // see parseAdminPeriod below). projectsFinished relies on projects.completed_at,
      // which degrades to 0 until that column's migration is applied.
      const { from, to, prevFrom, prevTo } = parseAdminPeriod(req);
      const [
        newUsers, prevNewUsers,
        newCompanies, prevNewCompanies,
        tasksSolvedInPeriod, tasksSolvedInPrevPeriod,
        projectsFinishedInPeriod, projectsFinishedInPrevPeriod,
      ] = await Promise.all([
        countInRange('profiles', 'created_at', from, to),
        countInRange('profiles', 'created_at', prevFrom, prevTo),
        countInRange('organizations', 'created_at', from, to),
        countInRange('organizations', 'created_at', prevFrom, prevTo),
        countInRange('tasks', 'completed_at', from, to, (q) => q.eq('status', 'Udført')),
        countInRange('tasks', 'completed_at', prevFrom, prevTo, (q) => q.eq('status', 'Udført')),
        countInRange('projects', 'completed_at', from, to),
        countInRange('projects', 'completed_at', prevFrom, prevTo),
      ]);

      const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const activeTrials = usersList.filter((u) => u.isTrialActive).length;
      const trialsExpiringSoon = usersList.filter((u) => u.isTrialActive && new Date(u.trialEndsAt).getTime() <= sevenDaysFromNow).length;

      res.json({
        stats: {
          userCount: profilesResult.count ?? 0,
          companyCount: companiesResult.count ?? 0,
          projectCount: projectsResult.count ?? 0,
          taskCount: tasksResult.count ?? 0,
          tasksSolved: tasksSolvedResult.count ?? 0,
          tasksOverdue: tasksOverdueResult.count ?? 0,
          activeTrials,
          trialsExpiringSoon,
        },
        users: usersList,
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
          newUsers: periodDelta(newUsers, prevNewUsers),
          newCompanies: periodDelta(newCompanies, prevNewCompanies),
          tasksSolved: periodDelta(tasksSolvedInPeriod, tasksSolvedInPrevPeriod),
          projectsFinished: periodDelta(projectsFinishedInPeriod, projectsFinishedInPrevPeriod),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/admin/overview] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente oversigt.', details: isProduction ? undefined : message });
    }
  });

  return router;
};
