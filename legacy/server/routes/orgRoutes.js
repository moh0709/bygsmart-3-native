// ─────────────────────────────────────────────────────────────────────────────
// Organization invite notification route (Phase 2, BYG 3.0).
//
// The organization_members invite row itself is written client-side under RLS
// (services/organizations.ts) — this route only re-verifies the caller's
// owner/admin role server-side (defense in depth) and sends what the client
// can't: a real SMTP e-mail, and — for an already-registered invitee — an
// in-app + web-push notification via notifyUserAndPush.
//
// NOTE: member management (roles, removal) happens directly under RLS; and
// invites to TEAM-BACKED orgs go through the existing team-seat flow
// (TeamManagementPage) so Stripe seat billing stays the single source of
// truth until Phase 8 — the client enforces that split, the org-mirror
// trigger keeps organization_members in sync either way.
//
// Mounted from server/index.js via:
//   app.use(createOrgRouter({ supabaseAdmin, getAuthenticatedUser, isUuid,
//                             isProduction, sensitiveLimiter,
//                             notifyUserAndPush }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { canManageOrg } from '../orgAccess.js';

export const createOrgRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  isUuid,
  isProduction,
  sensitiveLimiter,
  notifyUserAndPush,
}) => {
  const router = Router();

  // POST /api/org/invite-notify
  // Body: { orgId, granteeUserId? } XOR { orgId, granteeEmail? }
  router.post('/api/org/invite-notify', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverforbindelsen er ikke konfigureret.' });
      return;
    }

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        res.status(401).json({ error: 'Ikke autoriseret.' });
        return;
      }

      const { orgId, granteeUserId, granteeEmail } = req.body || {};
      if (!isUuid(orgId) || (!granteeUserId && !granteeEmail)) {
        res.status(400).json({ error: 'Ugyldige parametre.' });
        return;
      }
      if (granteeUserId && !isUuid(granteeUserId)) {
        res.status(400).json({ error: 'Ugyldige parametre.' });
        return;
      }

      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name, created_by')
        .eq('id', orgId)
        .maybeSingle();
      if (orgError || !org) {
        res.status(404).json({ error: 'Organisationen blev ikke fundet.' });
        return;
      }

      // Re-derive owner/admin authorization server-side.
      const { data: callerMembership } = await supabaseAdmin
        .from('organization_members')
        .select('role, status')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!canManageOrg(callerMembership)) {
        res.status(403).json({ error: 'Du har ikke rettigheder til at invitere til denne organisation.' });
        return;
      }

      // Defense in depth: the invite row this notification is about must exist.
      const inviteQuery = supabaseAdmin
        .from('organization_members')
        .select('user_id, invite_email')
        .eq('org_id', orgId)
        .in('status', ['pending', 'active']);
      const { data: inviteRows } = granteeUserId
        ? await inviteQuery.eq('user_id', granteeUserId)
        : await inviteQuery.eq('invite_email', granteeEmail.trim().toLowerCase());
      if (!inviteRows || inviteRows.length === 0) {
        res.status(404).json({ error: 'Invitationen findes ikke endnu.' });
        return;
      }

      // Resolve the invitee's e-mail + display name.
      let toEmail = granteeEmail ? granteeEmail.trim().toLowerCase() : null;
      let granteeName = '';
      let hasAccount = false;
      if (granteeUserId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, name')
          .eq('id', granteeUserId)
          .maybeSingle();
        toEmail = profile?.email ?? null;
        granteeName = profile?.name ?? '';
        hasAccount = true;
      }

      let emailStatus = 'skipped';
      try {
        const smtpConfig = await resolveSmtpConfig({ supabaseAdmin, ownerId: org.created_by });
        if (!smtpConfig || !toEmail) {
          emailStatus = 'skipped';
        } else {
          const greeting = granteeName ? `Hej ${granteeName},` : 'Hej,';
          const html = hasAccount
            ? `<p>${greeting}</p>` +
              `<p>Du er blevet inviteret til organisationen <strong>${org.name}</strong> i BygSmart.</p>` +
              `<p>Log ind og acceptér invitationen under Indstillinger → Organisation.</p>` +
              `<p>Med venlig hilsen<br/>BYG SMART</p>`
            : `<p>${greeting}</p>` +
              `<p>Du er inviteret til organisationen <strong>${org.name}</strong> i BygSmart.</p>` +
              `<p>Opret en konto med denne e-mailadresse for automatisk at blive medlem.</p>` +
              `<p>Med venlig hilsen<br/>BYG SMART</p>`;
          const result = await sendMail({
            transportOptions: smtpConfig,
            to: toEmail,
            subject: `Invitation til "${org.name}" i BygSmart`,
            html,
          });
          emailStatus = result.ok ? 'sent' : 'failed';
        }
      } catch (emailErr) {
        console.error('[api/org/invite-notify] email failed:', emailErr?.message ?? emailErr);
        emailStatus = 'failed';
      }

      let pushAttempted = false;
      if (hasAccount && granteeUserId) {
        pushAttempted = true;
        try {
          await notifyUserAndPush(granteeUserId, {
            title: 'BygSmart',
            text: `Du er inviteret til organisationen "${org.name}"`,
            link: '#/settings',
            type: 'org_invite',
            metadata: { orgId },
          });
        } catch (notifyErr) {
          console.error('[api/org/invite-notify] notify failed:', notifyErr?.message ?? notifyErr);
        }
      }

      res.status(200).json({ ok: true, emailStatus, pushAttempted });
    } catch (error) {
      console.error('[api/org/invite-notify] error:', error?.message ?? error);
      res.status(500).json({
        error: 'Invitationen kunne ikke sendes.',
        ...(isProduction ? {} : { details: error?.message ?? String(error) }),
      });
    }
  });

  return router;
};
