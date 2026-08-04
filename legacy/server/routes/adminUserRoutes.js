// ─────────────────────────────────────────────────────────────────────────────
// Admin user management routes. All guarded by ensureAdmin().
//
// Mounted from server/index.js via:
//   app.use(createAdminUserRouter({ supabaseAdmin, stripe, ensureAdmin,
//                                   notifyUserAndPush, cancelStripeForAccountDeletion,
//                                   removeUserFromTeamsAndDeleteOwnedProjects,
//                                   isProduction, adminLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

const VALID_TIERS = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];
const TRIAL_TIERS = ['PRO', 'PREMIUM', 'ENTERPRISE'];

// The name a demo profile carries until the visitor completes the welcome step
// (POST /api/demo-profile). Never-onboarded demo accounts — smoke tests and
// abandoned trials — are exactly the ones the bulk purge targets.
export const PLACEHOLDER_DEMO_NAME = 'Demo Bruger';

export const createAdminUserRouter = ({
  supabaseAdmin,
  getStripeForUserType,
  stripeModeForUserType,
  ensureAdmin,
  notifyUserAndPush,
  cancelStripeForAccountDeletion,
  removeUserFromTeamsAndDeleteOwnedProjects,
  isProduction,
  adminLimiter,
}) => {
  const router = Router();

  // Loads a target profile (for action endpoints) or writes a 404 and returns null.
  const loadTargetProfile = async (id, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, app_role, is_demo, stripe_customer_id, user_type')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      res.status(404).json({ error: 'Brugeren blev ikke fundet.' });
      return null;
    }
    return data;
  };

  // PATCH /api/admin/users/:id — edit core profile fields.
  router.patch('/api/admin/users/:id', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    const { name, email, phone, jobTitle, subscriptionTier, companyName } = req.body || {};
    const update = { updated_at: new Date().toISOString() };
    if (typeof name === 'string') update.name = name.trim();
    if (typeof email === 'string') update.email = email.trim() || null;
    if (typeof phone === 'string') update.phone = phone.trim() || null;
    if (typeof jobTitle === 'string') update.job_title = jobTitle.trim() || null;
    if (typeof companyName === 'string') update.company_name = companyName.trim() || null;
    if (typeof subscriptionTier === 'string') {
      if (!VALID_TIERS.includes(subscriptionTier)) {
        res.status(400).json({ error: 'Ugyldigt abonnementsniveau.' });
        return;
      }
      update.subscription_tier = subscriptionTier;
    }

    const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', target.id);
    if (error) {
      console.error('[api/admin/users PATCH] error:', error.message);
      res.status(500).json({ error: 'Profilen kunne ikke opdateres.' });
      return;
    }
    res.json({ ok: true });
  });

  // PATCH /api/admin/users/:id/role — change app_role (user | admin).
  router.patch('/api/admin/users/:id/role', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'user') {
      res.status(400).json({ error: 'Ugyldig rolle.' });
      return;
    }

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    if (target.id === admin.id && role !== 'admin') {
      res.status(400).json({ error: 'Du kan ikke fjerne din egen administratorrolle.' });
      return;
    }

    // Prevent removing the last remaining admin.
    if (target.app_role === 'admin' && role !== 'admin') {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('app_role', 'admin');
      if ((count ?? 0) <= 1) {
        res.status(400).json({ error: 'Mindst én administrator skal bevares.' });
        return;
      }
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ app_role: role, updated_at: new Date().toISOString() })
      .eq('id', target.id);
    if (error) {
      console.error('[api/admin/users/role] error:', error.message);
      res.status(500).json({ error: 'Rollen kunne ikke ændres.' });
      return;
    }
    res.json({ ok: true, role });
  });

  // PATCH /api/admin/users/:id/user-type — set classification (normal | test |
  // partner | admin). Drives Stripe test-vs-live mode ('test'/'admin' -> test
  // keys). 'admin' syncs app_role='admin'; anything else syncs app_role='user',
  // so this dropdown is the single control for admin — reusing the same
  // "can't demote self / keep >=1 admin" guards as the /role endpoint.
  router.patch('/api/admin/users/:id/user-type', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { userType } = req.body || {};
    if (!['normal', 'test', 'partner', 'admin'].includes(userType)) {
      res.status(400).json({ error: 'Ugyldig brugertype.' });
      return;
    }

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    const nextAppRole = userType === 'admin' ? 'admin' : 'user';

    if (target.id === admin.id && nextAppRole !== 'admin') {
      res.status(400).json({ error: 'Du kan ikke fjerne din egen administratorrolle.' });
      return;
    }

    // Prevent removing the last remaining admin.
    if (target.app_role === 'admin' && nextAppRole !== 'admin') {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('app_role', 'admin');
      if ((count ?? 0) <= 1) {
        res.status(400).json({ error: 'Mindst én administrator skal bevares.' });
        return;
      }
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ user_type: userType, app_role: nextAppRole, updated_at: new Date().toISOString() })
      .eq('id', target.id);
    if (error) {
      console.error('[api/admin/users/user-type] error:', error.message);
      res.status(500).json({ error: 'Brugertypen kunne ikke ændres.' });
      return;
    }
    res.json({ ok: true, userType, appRole: nextAppRole });
  });

  // POST /api/admin/users/:id/deactivate — ban the user (blocks login).
  router.post('/api/admin/users/:id/deactivate', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    if (target.id === admin.id) {
      res.status(400).json({ error: 'Du kan ikke deaktivere din egen konto.' });
      return;
    }

    // 100 years ≈ permanent ban until manually reactivated.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      ban_duration: '876000h',
    });
    if (error) {
      console.error('[api/admin/users/deactivate] error:', error.message);
      res.status(500).json({ error: 'Brugeren kunne ikke deaktiveres.' });
      return;
    }
    res.json({ ok: true, isActive: false });
  });

  // POST /api/admin/users/:id/activate — lift the ban.
  router.post('/api/admin/users/:id/activate', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      ban_duration: 'none',
    });
    if (error) {
      console.error('[api/admin/users/activate] error:', error.message);
      res.status(500).json({ error: 'Brugeren kunne ikke aktiveres.' });
      return;
    }
    res.json({ ok: true, isActive: true });
  });

  // PATCH /api/admin/users/:id/trial — grant, extend, or revoke an admin trial.
  // Body: { tier: 'PRO'|'PREMIUM'|'ENTERPRISE', days?: number, endsAt?: ISO string }
  // to grant/extend, or { tier: null } to revoke early. This never touches
  // subscription_tier — see the migration comment on trial_tier for why — so it
  // carries no Stripe/billing side effects and cannot affect team-tier sync.
  router.patch('/api/admin/users/:id/trial', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    const { tier, days, endsAt } = req.body || {};

    if (tier === null) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ trial_tier: null, trial_ends_at: null, trial_granted_by: null, trial_granted_at: null, updated_at: new Date().toISOString() })
        .eq('id', target.id);
      if (error) {
        console.error('[api/admin/users/trial] revoke error:', error.message);
        res.status(500).json({ error: 'Trial kunne ikke fjernes.' });
        return;
      }
      res.json({ ok: true, trialTier: null, trialEndsAt: null });
      return;
    }

    if (!TRIAL_TIERS.includes(tier)) {
      res.status(400).json({ error: 'Ugyldigt abonnementsniveau til trial.' });
      return;
    }

    let resolvedEndsAt;
    if (typeof endsAt === 'string' && endsAt) {
      resolvedEndsAt = new Date(endsAt);
    } else if (typeof days === 'number' && days > 0) {
      resolvedEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    if (!resolvedEndsAt || Number.isNaN(resolvedEndsAt.getTime()) || resolvedEndsAt.getTime() <= Date.now()) {
      res.status(400).json({ error: 'Angiv enten "days" (positivt antal) eller en fremtidig "endsAt"-dato.' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        trial_tier: tier,
        trial_ends_at: resolvedEndsAt.toISOString(),
        trial_granted_by: admin.id,
        trial_granted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id);
    if (error) {
      console.error('[api/admin/users/trial] grant error:', error.message);
      res.status(500).json({ error: 'Trial kunne ikke oprettes.' });
      return;
    }
    res.json({ ok: true, trialTier: tier, trialEndsAt: resolvedEndsAt.toISOString() });
  });

  // POST /api/admin/users/:id/notify — send an in-app + push notification.
  router.post('/api/admin/users/:id/notify', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const { title, text, link } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Beskedtekst er påkrævet.' });
      return;
    }

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    try {
      await notifyUserAndPush(target.id, {
        title: typeof title === 'string' ? title.trim() : undefined,
        text: text.trim(),
        link: typeof link === 'string' ? link.trim() : undefined,
      });
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error('[api/admin/users/notify] error:', err?.message);
      res.status(500).json({ error: 'Notifikationen kunne ikke sendes.' });
    }
  });

  // GET /api/admin/users/:id/invoices — Stripe invoices for the user.
  router.get('/api/admin/users/:id/invoices', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    const stripe = getStripeForUserType(target.user_type);
    if (!stripe) {
      res.json({ invoices: [], note: 'Stripe er ikke konfigureret.' });
      return;
    }
    if (!target.stripe_customer_id) {
      res.json({ invoices: [], note: 'Ingen Stripe-kunde tilknyttet.' });
      return;
    }

    try {
      const list = await stripe.invoices.list({ customer: target.stripe_customer_id, limit: 24 });
      const invoices = (list.data || []).map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        hostedInvoiceUrl: inv.hosted_invoice_url || null,
        pdfUrl: inv.invoice_pdf || null,
      }));
      res.json({ invoices });
    } catch (err) {
      console.error('[api/admin/users/invoices] error:', err?.message);
      res.status(500).json({ error: 'Fakturaer kunne ikke hentes.' });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Full account teardown, shared by the single delete and the demo purge.
  //
  // auth.admin.deleteUser cascades through profiles to everything with an
  // ON DELETE CASCADE foreign key (organizations the user created, org
  // memberships, org teams, notifications, connections…). Three things need
  // doing by hand first:
  //   1. Stripe subscriptions — nothing in the database cancels those.
  //   2. Owned projects — projects.owner_id is ON DELETE SET NULL, so they
  //      would survive as orphans instead of being removed.
  //   3. Rows whose FK is NO ACTION (chat messages, quality controls, org-team
  //      invites) in projects the user does NOT own — the cascade never reaches
  //      them and they would abort the delete.
  // ───────────────────────────────────────────────────────────────────────────
  const deleteUserCompletely = async (target) => {
    await cancelStripeForAccountDeletion(
      target.stripe_customer_id ?? null,
      stripeModeForUserType(target.user_type)
    );
    await removeUserFromTeamsAndDeleteOwnedProjects(target.id);

    const cleanup = await Promise.all([
      supabaseAdmin.from('time_entries').delete().eq('user_id', target.id),
      supabaseAdmin.from('notifications').delete().eq('user_id', target.id),
      supabaseAdmin.from('logs').delete().eq('user_id', target.id),
      supabaseAdmin.from('push_subscriptions').delete().eq('user_id', target.id),
      supabaseAdmin
        .from('user_connections')
        .delete()
        .or(`user_id.eq.${target.id},connected_user_id.eq.${target.id}`),
      // NO ACTION references left behind in other people's projects.
      supabaseAdmin.from('task_chat_messages').delete().eq('sender_id', target.id),
      supabaseAdmin.from('task_quality_controls').delete().eq('author_id', target.id),
      supabaseAdmin
        .from('task_quality_controls')
        .update({ responsible_id: null })
        .eq('responsible_id', target.id),
      supabaseAdmin.from('org_team_members').delete().eq('invited_by', target.id),
      supabaseAdmin.from('org_teams').delete().eq('created_by', target.id),
    ]);
    const cleanupError = cleanup.find((r) => r.error);
    if (cleanupError?.error) throw new Error(cleanupError.error.message);

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(target.id);
    if (deleteAuthError) throw new Error(deleteAuthError.message);
  };

  // GET /api/admin/demo-users/purgeable — dry run for the bulk purge below.
  // Always call this before purging: it is the list the confirmation shows.
  router.get('/api/admin/demo-users/purgeable', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, demo_contact_email, created_at')
        .eq('is_demo', true)
        .eq('name', PLACEHOLDER_DEMO_NAME)
        .order('created_at', { ascending: false });
      if (error) throw error;

      res.json({
        users: (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          demoContactEmail: p.demo_contact_email || null,
          createdAt: p.created_at,
        })),
      });
    } catch (err) {
      console.error('[api/admin/demo-users/purgeable] error:', err?.message);
      res.status(500).json({ error: 'Demokonti kunne ikke hentes.' });
    }
  });

  // POST /api/admin/demo-users/purge — delete every demo account that never
  // completed the welcome step (still named "Demo Bruger"). Demo accounts whose
  // visitor did introduce themselves are real leads and are deliberately left
  // alone; delete those one by one if needed.
  router.post('/api/admin/demo-users/purge', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    try {
      const { data: targets, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, is_demo, stripe_customer_id, user_type')
        .eq('is_demo', true)
        .eq('name', PLACEHOLDER_DEMO_NAME);
      if (error) throw error;

      const deleted = [];
      const failed = [];

      // Sequential on purpose — each teardown issues a batch of writes, and a
      // partial failure must not take the rest of the purge down with it.
      for (const target of targets || []) {
        if (target.id === admin.id) continue;
        try {
          await deleteUserCompletely(target);
          deleted.push(target.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Ukendt fejl';
          console.error(`[api/admin/demo-users/purge] ${target.id} failed:`, message);
          failed.push({ id: target.id, email: target.email, error: message });
        }
      }

      res.json({ deletedCount: deleted.length, failedCount: failed.length, failed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/admin/demo-users/purge] error:', message);
      res.status(500).json({ error: 'Demokonti kunne ikke slettes.', details: isProduction ? undefined : message });
    }
  });

  // DELETE /api/admin/users/:id — permanently delete a user (mirrors self-delete).
  router.delete('/api/admin/users/:id', adminLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const target = await loadTargetProfile(req.params.id, res);
    if (!target) return;

    if (target.id === admin.id) {
      res.status(400).json({ error: 'Du kan ikke slette din egen konto her.' });
      return;
    }

    try {
      await deleteUserCompletely(target);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/admin/users DELETE] error:', message);
      res.status(500).json({ error: 'Brugeren kunne ikke slettes.', details: isProduction ? undefined : message });
    }
  });

  return router;
};
