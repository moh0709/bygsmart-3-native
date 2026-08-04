// ─────────────────────────────────────────────────────────────────────────────
// Public contact-form route — bygsmart.com/kontakt.html POSTs here.
//
// Mounted from server/index.js via:
//   app.use(createContactRouter({ supabaseAdmin, sensitiveLimiter }))
//
// Reuses the existing global SMTP config (server/email.js, server/smtpRoutes.js)
// so no new mail infrastructure is introduced — an admin must configure and
// enable the global SMTP settings via /api/smtp/global before this can deliver
// mail. Unauthenticated by design (public marketing site), so it leans on
// sensitiveLimiter + a honeypot field for basic abuse resistance.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { validateContactEmail } from '../demoAccess.js';

const CONTACT_RECIPIENT = process.env.CONTACT_FORM_RECIPIENT || 'support@bygsmart.com';

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const validateName = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed.length > 120) {
    throw new Error('Angiv venligst dit navn.');
  }
  return trimmed;
};

const validateSubject = (subject) => {
  const trimmed = String(subject || '').trim();
  if (!trimmed || trimmed.length > 160) {
    throw new Error('Angiv venligst et emne.');
  }
  return trimmed;
};

const validateMessage = (message) => {
  const trimmed = String(message || '').trim();
  if (!trimmed || trimmed.length < 10) {
    throw new Error('Beskeden skal være mindst 10 tegn.');
  }
  if (trimmed.length > 5000) {
    throw new Error('Beskeden er for lang (maks. 5000 tegn).');
  }
  return trimmed;
};

export const createContactRouter = ({ supabaseAdmin, sensitiveLimiter }) => {
  const router = Router();

  router.post('/api/contact', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return;
    }

    try {
      const body = req.body ?? {};

      // Honeypot: a real visitor never fills this hidden field. Silently
      // report success without sending mail (don't tip off the bot).
      if (typeof body.website === 'string' && body.website.trim() !== '') {
        return res.status(200).json({ ok: true });
      }

      const name = validateName(body.name);
      const email = validateContactEmail(body.email);
      const subject = validateSubject(body.subject);
      const message = validateMessage(body.message);
      const company = body.company ? String(body.company).trim().slice(0, 160) : '';

      const transportOptions = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
      if (!transportOptions) {
        console.error('[api/contact] No global SMTP config enabled — message not sent.');
        return res.status(503).json({
          error: 'Kontaktformularen er midlertidigt utilgængelig. Skriv venligst direkte til support@bygsmart.com.',
        });
      }

      const html = `
        <h2>Ny besked fra kontaktformularen på bygsmart.com</h2>
        <p><strong>Navn:</strong> ${escapeHtml(name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        ${company ? `<p><strong>Virksomhed:</strong> ${escapeHtml(company)}</p>` : ''}
        <p><strong>Emne:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Besked:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `;
      const text = `Ny besked fra kontaktformularen på bygsmart.com

Navn: ${name}
E-mail: ${email}
${company ? `Virksomhed: ${company}\n` : ''}Emne: ${subject}

${message}`;

      const result = await sendMail({
        transportOptions,
        to: CONTACT_RECIPIENT,
        subject: `[Kontakt] ${subject}`,
        html,
        text,
      });

      if (!result.ok) {
        console.error('[api/contact] sendMail failed:', result.error);
        return res.status(502).json({ error: 'Beskeden kunne ikke sendes. Prøv igen senere.' });
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ugyldig forespørgsel.';
      res.status(400).json({ error: message });
    }
  });

  return router;
};
