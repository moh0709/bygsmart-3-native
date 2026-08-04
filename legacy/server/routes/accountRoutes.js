// ─────────────────────────────────────────────────────────────────────────────
// Self-service account deletion route.
//
// Mounted from server/index.js via:
//   app.use(createAccountRouter({ supabaseAdmin, getAuthenticatedUser,
//                                 cancelStripeForAccountDeletion,
//                                 removeUserFromTeamsAndDeleteOwnedProjects,
//                                 isProduction, sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { isDemoUser } from '../demoAccess.js';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { renderBrandedEmail } from '../emailTemplates.js';

export const createAccountRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  stripeModeForUserType,
  cancelStripeForAccountDeletion,
  removeUserFromTeamsAndDeleteOwnedProjects,
  isProduction,
  sensitiveLimiter,
}) => {
  const router = Router();

  router.post('/api/delete-account', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Supabase server credentials are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (isDemoUser(user)) {
      res.status(403).json({ error: 'Demo accounts cannot be deleted from the app.' });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id, user_type, name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({ error: 'Unable to load account profile for deletion.' });
      return;
    }

    try {
      await cancelStripeForAccountDeletion(
        profile?.stripe_customer_id ?? null,
        stripeModeForUserType(profile?.user_type)
      );

      await removeUserFromTeamsAndDeleteOwnedProjects(user.id);

      const cleanupOperations = [
        supabaseAdmin.from('time_entries').delete().eq('user_id', user.id),
        supabaseAdmin.from('notifications').delete().eq('user_id', user.id),
        supabaseAdmin.from('logs').delete().eq('user_id', user.id),
        supabaseAdmin
          .from('user_connections')
          .delete()
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`),
      ];

      const cleanupResults = await Promise.all(cleanupOperations);
      const cleanupError = cleanupResults.find((result) => result.error);
      if (cleanupError?.error) {
        throw new Error(cleanupError.error.message);
      }

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteAuthError) {
        throw new Error(deleteAuthError.message);
      }

      // Goodbye confirmation e-mail (best-effort, after the account is actually
      // gone). Sent directly — the notification path is unavailable because the
      // user's rows (incl. notifications + prefs) are already deleted.
      try {
        const to = profile?.email || null;
        const smtp = to ? await resolveSmtpConfig({ supabaseAdmin, ownerId: null }) : null;
        if (to && smtp) {
          const name = profile?.name || to.split('@')[0];
          const { html, text } = renderBrandedEmail({
            heading: 'Din konto er slettet',
            greetingName: name,
            bodyLines: [
              'Din BygSmart-konto er nu slettet permanent, og dine personlige data er fjernet.',
              'Tak fordi du brugte BygSmart — du er altid velkommen tilbage.',
            ],
            ctaLabel: 'Opret ny konto',
            ctaUrl: 'https://app.bygsmart.com/#/register',
            previewText: 'Din konto er slettet',
            showManageLink: false,
          });
          await sendMail({
            transportOptions: smtp,
            to,
            subject: 'Din konto er slettet · BygSmart',
            html,
            text,
          });
        }
      } catch (mailErr) {
        console.error('[api/delete-account] goodbye email failed:', mailErr?.message ?? mailErr);
      }

      res.status(200).json({ message: 'Kontoen er slettet permanent.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown deletion error';
      console.error('[api/delete-account] error:', message);
      res
        .status(500)
        .json({ error: 'Account deletion failed.', details: isProduction ? undefined : message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/account/welcome
  // Sends the one-time branded welcome email. Called fire-and-forget by the
  // client after login/registration; idempotent via profiles.welcomed_at, so
  // repeated calls (every login) send at most once. Respects the 'welcome' email
  // preference (default ON). Demo users are excluded.
  // ───────────────────────────────────────────────────────────────────────────
  router.post('/api/account/welcome', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (isDemoUser(user)) {
      res.json({ sent: false, reason: 'demo' });
      return;
    }

    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, welcomed_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || profile.welcomed_at) {
        res.json({ sent: false, already: true });
        return;
      }

      // Atomically claim the welcome so concurrent logins can't double-send.
      const { data: claimed } = await supabaseAdmin
        .from('profiles')
        .update({ welcomed_at: new Date().toISOString() })
        .eq('id', user.id)
        .is('welcomed_at', null)
        .select('id');
      if (!claimed || claimed.length === 0) {
        res.json({ sent: false, already: true });
        return;
      }

      // Respect the optional 'welcome' email preference (absence = ON).
      let emailEnabled = true;
      const { data: pref } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_enabled')
        .eq('user_id', user.id)
        .eq('event_key', 'welcome')
        .maybeSingle();
      if (pref) emailEnabled = pref.email_enabled !== false;

      let sent = false;
      if (emailEnabled && profile.email) {
        const smtp = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
        if (smtp) {
          const name = profile.name || profile.email.split('@')[0];
          const { html, text } = renderBrandedEmail({
            heading: 'Velkommen til BygSmart',
            greetingName: name,
            bodyLines: [
              'Tak fordi du oprettede en konto hos BygSmart — vi er glade for at have dig med.',
              'Kom godt i gang: opret dit første projekt, tilføj opgaver, og udforsk beregnerne.',
            ],
            ctaLabel: 'Åbn BygSmart',
            ctaUrl: 'https://app.bygsmart.com/#/home',
            previewText: 'Velkommen til BygSmart',
            showManageLink: true,
          });
          const result = await sendMail({
            transportOptions: smtp,
            to: profile.email,
            subject: 'Velkommen til BygSmart',
            html,
            text,
          });
          sent = result.ok;
        }
      }
      res.json({ sent });
    } catch (err) {
      console.error('[api/account/welcome] error:', err?.message ?? err);
      res.status(500).json({ error: 'Welcome email failed.' });
    }
  });

  return router;
};
