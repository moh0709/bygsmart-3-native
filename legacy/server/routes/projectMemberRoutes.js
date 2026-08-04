// ─────────────────────────────────────────────────────────────────────────────
// Project member termination route.
//
// Mounted from server/index.js via:
//   app.use(createProjectMemberRouter({ supabaseAdmin, getAuthenticatedUser,
//                                       isUuid, isProduction, sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { gatherHandoverData, generateHandoverReportPdf } from '../handoverReport.js';
import { resolveSmtpConfig, sendMail } from '../email.js';

export const createProjectMemberRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  isUuid,
  isProduction,
  sensitiveLimiter,
}) => {
  const router = Router();

  // POST /api/project/terminate-member
  // Owner-only termination of a collaboration. Orchestrates, in order:
  //   1. owner verification
  //   2. handover report (OVERDRAGELSESRAPPORT) generation + storage upload
  //   3. access revocation (resource_task_access, project_resources — which
  //      re-syncs projects.team via trigger — quick_task_access, tasks.assignees)
  //   4. e-mail with the report attached (non-fatal)
  //   5. in-app notification (non-fatal)
  //   6. audit row in member_terminations
  //   7. a 1-hour signed URL so the owner can download the report
  //
  // Non-fatal steps (report, email, notification) are wrapped so the access
  // revocation always completes even when they fail.
  router.post('/api/project/terminate-member', sensitiveLimiter, async (req, res) => {
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

      const { projectId, removedUserId } = req.body || {};
      // Strict UUID validation — these ids are interpolated into a PostgREST
      // .or() filter downstream (handoverData.js) and used in a storage path, so
      // rejecting anything non-UUID closes both filter-injection and path-traversal.
      if (!isUuid(projectId) || !isUuid(removedUserId)) {
        res.status(400).json({ error: 'Ugyldige parametre.' });
        return;
      }

      // Verify caller is the project owner — this is the authoritative check.
      const { data: project, error: projError } = await supabaseAdmin
        .from('projects')
        .select('id, owner_id, name')
        .eq('id', projectId)
        .maybeSingle();

      if (projError || !project) {
        res.status(404).json({ error: 'Projektet blev ikke fundet.' });
        return;
      }

      if (project.owner_id !== user.id) {
        res.status(403).json({ error: 'Kun projektejeren kan opsige et samarbejde.' });
        return;
      }

      // The owner cannot terminate their own membership.
      if (removedUserId === user.id) {
        res.status(400).json({ error: 'Du kan ikke opsige dit eget medlemskab.' });
        return;
      }

      // ── 2. Handover report (non-fatal) ───────────────────────────────────────
      // reportReady tracks report generation/upload success independently of
      // `payload`: gatherHandoverData can succeed while the PDF generation or
      // upload fails, in which case `payload` stays populated but no usable report
      // (pdfBuffer/reportPath) exists. Downstream steps must key off reportReady,
      // not `payload`, so they never promise a report that was not produced.
      let reportPath = null;
      let pdfBuffer = null;
      let payload = null;
      let reportReady = false;
      try {
        payload = await gatherHandoverData({ supabaseAdmin, projectId, removedUserId });
        pdfBuffer = await generateHandoverReportPdf({
          project: payload.project,
          member: payload.member,
          data: payload,
          generatedAt: new Date().toISOString(),
        });
        // Org-prefixed path (Phase 6 storage isolation); falls back to the
        // legacy shape when the project predates the org model.
        const { data: projectOrgRow } = await supabaseAdmin
          .from('projects')
          .select('org_id')
          .eq('id', projectId)
          .maybeSingle();
        const storagePath = projectOrgRow?.org_id
          ? `org/${projectOrgRow.org_id}/project/${projectId}/reports/${removedUserId}-${Date.now()}.pdf`
          : `handover-reports/${projectId}/${removedUserId}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('task-docs')
          .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
        if (uploadError) throw uploadError;
        reportPath = `task-docs/${storagePath}`;
        reportReady = true;
      } catch (reportErr) {
        console.error('[api/project/terminate-member] report generation failed:', reportErr?.message ?? reportErr);
        reportPath = null;
        pdfBuffer = null;
        reportReady = false;
      }

      // The removed member's e-mail (if the payload was gathered).
      const removedUserEmail = payload?.member?.email ?? null;

      // ── 3. Access revocation (must succeed — atomic) ─────────────────────────
      // All access vectors are revoked inside a single SECURITY DEFINER transaction
      // (revoke_project_member_access): resource_task_access, project_resources
      // (which re-syncs projects.team via trigger), quick_task_access for the
      // project's tasks, and tasks.assignees. Doing this in one RPC guarantees the
      // database can never be left in a partial state if a later step fails.
      const { error: revokeError } = await supabaseAdmin.rpc('revoke_project_member_access', {
        p_project_id: projectId,
        p_user_id: removedUserId,
      });
      if (revokeError) throw new Error(`Kunne ikke fjerne adgang: ${revokeError.message}`);

      // ── 4. E-mail with report attached (non-fatal) ───────────────────────────
      // The e-mail body promises an attached handover report, so we only send when
      // a valid pdfBuffer exists. If SMTP is configured and a recipient is known
      // but the report is unavailable, we record 'failed' rather than send a
      // misleading attachment-less e-mail.
      let emailStatus = 'skipped';
      try {
        const smtpConfig = await resolveSmtpConfig({ supabaseAdmin, ownerId: project.owner_id });
        if (!smtpConfig || !removedUserEmail) {
          emailStatus = 'skipped';
        } else if (!reportReady || !pdfBuffer) {
          emailStatus = 'failed';
        } else {
          const result = await sendMail({
            transportOptions: smtpConfig,
            to: removedUserEmail,
            subject: `Afslutning af samarbejde – ${project.name}`,
            html:
              `<p>Hej ${payload?.member?.name || ''},</p>` +
              `<p>Dit samarbejde på projektet <strong>${project.name}</strong> er blevet afsluttet.</p>` +
              `<p>Vedhæftet finder du en overdragelsesrapport med et resumé af dit bidrag til projektet.</p>` +
              `<p>Med venlig hilsen<br/>BYG SMART</p>`,
            attachments: [{ filename: 'overdragelsesrapport.pdf', content: pdfBuffer }],
          });
          emailStatus = result.ok ? 'sent' : 'failed';
        }
      } catch (emailErr) {
        console.error('[api/project/terminate-member] email failed:', emailErr?.message ?? emailErr);
        emailStatus = 'failed';
      }

      // ── 5. In-app notification (non-fatal) ───────────────────────────────────
      // Build the text from the actual outcome so it never claims a report was
      // e-mailed when it was skipped or failed.
      const notificationText = emailStatus === 'sent'
        ? `Du er blevet fjernet fra projektet "${project.name}". En overdragelsesrapport er sendt til din e-mail.`
        : `Du er blevet fjernet fra projektet "${project.name}".`;
      try {
        const { error: notifError } = await supabaseAdmin.from('notifications').insert({
          user_id: removedUserId,
          text: notificationText,
          timestamp: new Date().toISOString(),
          is_read: false,
          link: '/projects',
          type: 'project_terminated',
          metadata: { projectId, projectName: project.name },
        });
        if (notifError) {
          console.error('[api/project/terminate-member] notification error:', notifError.message);
        }
      } catch (notifErr) {
        console.error('[api/project/terminate-member] notification failed:', notifErr?.message ?? notifErr);
      }

      // ── 6. Audit row (required — failure fails the termination) ───────────────
      // The owner explicitly requires an audit trail for every termination. If the
      // audit record cannot be written we must not return success, otherwise the
      // caller would believe a record exists when it does not.
      const { error: auditError } = await supabaseAdmin.from('member_terminations').insert({
        project_id: projectId,
        removed_user_id: removedUserId,
        removed_by: user.id,
        report_path: reportPath ?? null,
        email_status: emailStatus,
      });
      if (auditError) {
        console.error('[api/project/terminate-member] audit insert error:', auditError.message);
        throw new Error(`Kunne ikke registrere opsigelsen i revisionssporet: ${auditError.message}`);
      }

      // ── 7. Signed URL for the owner to download the report ───────────────────
      let reportSignedUrl = null;
      if (reportPath) {
        const bucketPath = reportPath.startsWith('task-docs/')
          ? reportPath.slice('task-docs/'.length)
          : reportPath;
        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from('task-docs')
          .createSignedUrl(bucketPath, 3600);
        if (signedError) {
          console.error('[api/project/terminate-member] signed url error:', signedError.message);
        } else {
          reportSignedUrl = signed?.signedUrl ?? null;
        }
      }

      res.status(200).json({ ok: true, emailStatus, reportSignedUrl });
    } catch (error) {
      console.error('[api/project/terminate-member] error:', error?.message ?? error);
      res.status(500).json({
        error: 'Samarbejdet kunne ikke opsiges.',
        ...(isProduction ? {} : { details: error?.message ?? String(error) }),
      });
    }
  });

  return router;
};
