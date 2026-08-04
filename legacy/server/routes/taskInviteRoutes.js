// ─────────────────────────────────────────────────────────────────────────────
// Task-access invite notification route.
//
// The quick_task_access grant/invite row itself is written client-side under
// RLS (services/taskAccess.ts) — this route only re-verifies that write server-
// side (defense in depth) and sends the notification the client can't send
// itself: a real SMTP e-mail, and — for an already-registered invitee — an
// in-app + web-push notification via notifyUserAndPush.
//
// Mounted from server/index.js via:
//   app.use(createTaskInviteRouter({ supabaseAdmin, getAuthenticatedUser,
//                                    isUuid, isProduction, sensitiveLimiter,
//                                    notifyUserAndPush }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { canGrantTaskInvite } from '../taskInviteAccess.js';

export const createTaskInviteRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  isUuid,
  isProduction,
  sensitiveLimiter,
  notifyUserAndPush,
}) => {
  const router = Router();

  // POST /api/task/invite-notify
  // Body: { taskId, granteeUserId? } XOR { taskId, granteeEmail? }
  router.post('/api/task/invite-notify', sensitiveLimiter, async (req, res) => {
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

      const { taskId, granteeUserId, granteeEmail } = req.body || {};
      if (!isUuid(taskId) || (!granteeUserId && !granteeEmail)) {
        res.status(400).json({ error: 'Ugyldige parametre.' });
        return;
      }
      if (granteeUserId && !isUuid(granteeUserId)) {
        res.status(400).json({ error: 'Ugyldige parametre.' });
        return;
      }

      const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, project_id, owner_id')
        .eq('id', taskId)
        .maybeSingle();
      if (taskError || !task) {
        res.status(404).json({ error: 'Opgaven blev ikke fundet.' });
        return;
      }

      let project = null;
      if (task.project_id) {
        const { data: projectRow } = await supabaseAdmin
          .from('projects')
          .select('id, owner_id, name, team')
          .eq('id', task.project_id)
          .maybeSingle();
        project = projectRow ?? null;
      }

      // Re-derive owner/responsible authorization server-side (canGrantTaskInvite
      // mirrors get_effective_task_role's precedence against data already
      // fetched via the trusted admin client, since a service-role call has
      // no auth.uid() context to invoke that RPC directly).
      let explicitGrantRole = null;
      const cheapGrant = canGrantTaskInvite({ userId: user.id, task, project });
      if (!cheapGrant) {
        const { data: grantRow } = await supabaseAdmin
          .from('quick_task_access')
          .select('role')
          .eq('task_id', taskId)
          .eq('user_id', user.id)
          .in('status', ['pending', 'active'])
          .maybeSingle();
        explicitGrantRole = grantRow?.role ?? null;
      }
      if (!canGrantTaskInvite({ userId: user.id, task, project, explicitGrantRole })) {
        res.status(403).json({ error: 'Du har ikke rettigheder til at invitere til denne opgave.' });
        return;
      }

      // Defense in depth: confirm the access row this notification is about
      // actually exists (the client should already have written it).
      const grantQuery = supabaseAdmin
        .from('quick_task_access')
        .select('user_id, invite_email')
        .eq('task_id', taskId)
        .in('status', ['pending', 'active']);
      const { data: grantRows } = granteeUserId
        ? await grantQuery.eq('user_id', granteeUserId)
        : await grantQuery.eq('invite_email', granteeEmail.trim().toLowerCase());
      if (!grantRows || grantRows.length === 0) {
        res.status(404).json({ error: 'Adgangen findes ikke endnu.' });
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

      const smtpOwnerId = project ? project.owner_id : task.owner_id;
      const taskLink = `/#/task/${taskId}`;

      let emailStatus = 'skipped';
      try {
        const smtpConfig = await resolveSmtpConfig({ supabaseAdmin, ownerId: smtpOwnerId });
        if (!smtpConfig || !toEmail) {
          emailStatus = 'skipped';
        } else {
          const greeting = granteeName ? `Hej ${granteeName},` : 'Hej,';
          const html = hasAccount
            ? `<p>${greeting}</p>` +
              `<p>Du er blevet tilføjet til opgaven <strong>${task.title}</strong> i BygSmart.</p>` +
              `<p>Log ind for at se den.</p>` +
              `<p>Med venlig hilsen<br/>BYG SMART</p>`
            : `<p>${greeting}</p>` +
              `<p>Du er inviteret til opgaven <strong>${task.title}</strong> i BygSmart.</p>` +
              `<p>Opret en konto med denne e-mailadresse for automatisk at få adgang til opgaven.</p>` +
              `<p>Med venlig hilsen<br/>BYG SMART</p>`;
          const result = await sendMail({
            transportOptions: smtpConfig,
            to: toEmail,
            subject: `Du er tilføjet til opgaven "${task.title}"`,
            html,
          });
          emailStatus = result.ok ? 'sent' : 'failed';
        }
      } catch (emailErr) {
        console.error('[api/task/invite-notify] email failed:', emailErr?.message ?? emailErr);
        emailStatus = 'failed';
      }

      let pushAttempted = false;
      if (hasAccount && granteeUserId) {
        pushAttempted = true;
        try {
          await notifyUserAndPush(granteeUserId, {
            title: 'BygSmart',
            text: `Du er blevet tilføjet til opgaven "${task.title}"`,
            link: taskLink,
            type: 'task_invite',
            metadata: { taskId },
          });
        } catch (notifyErr) {
          console.error('[api/task/invite-notify] notify failed:', notifyErr?.message ?? notifyErr);
        }
      }

      res.status(200).json({ ok: true, emailStatus, pushAttempted });
    } catch (error) {
      console.error('[api/task/invite-notify] error:', error?.message ?? error);
      res.status(500).json({
        error: 'Invitationen kunne ikke sendes.',
        ...(isProduction ? {} : { details: error?.message ?? String(error) }),
      });
    }
  });

  return router;
};
