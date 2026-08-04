// ─────────────────────────────────────────────────────────────────────────────
// Platform invite route — invite someone who does not have a BygSmart account
// yet by email. Records the invite (connection_invites) and sends a branded
// invitation email with a short pitch + signup link.
//
// Mounted from server/index.js via:
//   app.use(createInviteRouter({ supabaseAdmin, getAuthenticatedUser,
//                                 sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { renderBrandedEmail } from '../emailTemplates.js';

const INVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const createInviteRouter = ({ supabaseAdmin, getAuthenticatedUser, sensitiveLimiter }) => {
  const router = Router();

  router.post('/api/invite', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    const { email, role } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Ugyldig e-mailadresse.' });
      return;
    }
    const inviteEmail = email.trim().toLowerCase();

    const allowedRoles = ['EMPLOYEE', 'EXTERNAL', 'MANAGER', 'CLIENT'];
    const inviteRole = allowedRoles.includes(role) ? role : 'EMPLOYEE';

    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Databaseforbindelsen er ikke konfigureret.' });
      return;
    }

    try {
      // Already a BygSmart user? Don't send a "create a profile" pitch to
      // someone who already has one — point the sender at Mit Netværk instead.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', inviteEmail)
        .maybeSingle();
      if (existingProfile) {
        res.json({ success: false, alreadyMember: true, message: 'Denne e-mail har allerede en BygSmart-konto — brug Mit Netværk for at forbinde.' });
        return;
      }

      // Cooldown: don't re-send within 24h if this inviter already invited this email.
      const { data: recent } = await supabaseAdmin
        .from('connection_invites')
        .select('id, created_at')
        .eq('inviter_id', user.id)
        .eq('invite_email', inviteEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent && Date.now() - new Date(recent.created_at).getTime() < INVITE_COOLDOWN_MS) {
        res.json({ success: true, alreadyInvited: true, message: `${email} er allerede inviteret for nylig.` });
        return;
      }

      const { error: dbError } = await supabaseAdmin
        .from('connection_invites')
        .insert({ inviter_id: user.id, invite_email: inviteEmail, role: inviteRole });
      if (dbError) {
        console.error('POST /api/invite insert error:', dbError);
        res.status(500).json({ error: 'Invitationen kunne ikke gemmes. Prøv igen.' });
        return;
      }

      const { data: inviterProfile } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      const inviterName = inviterProfile?.name || user.email || 'En kollega';

      const smtp = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
      if (!smtp) {
        console.error('POST /api/invite: no SMTP config — invite saved but no email sent');
        res.json({ success: true, emailSent: false, message: `Invitation til ${email} er registreret, men e-mail kunne ikke sendes (mailserver ikke konfigureret).` });
        return;
      }

      const { html, text } = renderBrandedEmail({
        heading: `${inviterName} har inviteret dig til BygSmart`,
        bodyLines: [
          `${inviterName} bruger BygSmart til at styre byggeprojekter og tænkte, det kunne være noget for dig.`,
          'BygSmart samler projekter, opgaver, tidsregistrering, tilbud, indkøb og kvalitetssikring ét sted — med en indbygget AI-assistent og over 80 byggeberegnere.',
          'Opret en gratis konto på under 2 minutter og kom i gang.',
        ],
        ctaLabel: 'Opret gratis konto',
        ctaUrl: 'https://app.bygsmart.com/#/register',
        previewText: `${inviterName} har inviteret dig til at prøve BygSmart`,
        showManageLink: false,
      });

      const result = await sendMail({
        transportOptions: smtp,
        to: email,
        subject: `${inviterName} har inviteret dig til BygSmart`,
        html,
        text,
      });

      if (!result.ok) {
        console.error('POST /api/invite sendMail error:', result.error);
        res.json({ success: true, emailSent: false, message: `Invitation til ${email} er registreret, men e-mailen kunne ikke sendes lige nu.` });
        return;
      }

      res.json({ success: true, emailSent: true, message: `Invitation sendt til ${email}.` });
    } catch (err) {
      console.error('POST /api/invite error:', err?.message ?? err);
      res.status(500).json({ error: 'Invitationen kunne ikke sendes. Prøv igen.' });
    }
  });

  return router;
};
