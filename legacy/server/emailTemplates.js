// ─────────────────────────────────────────────────────────────────────────────
// Branded transactional email templates (Danish).
//
// A single responsive, email-client-safe layout (inline CSS, table-based, no
// external assets) is shared by every notification. buildEmail() turns a
// notification row + resolved event into { subject, html, text }.
//
// The notification `text` is already a human Danish sentence describing what
// happened, so the generic layout wraps it with branding + a deep-link CTA. Add
// per-event bespoke bodies here later if richer content is wanted.
// ─────────────────────────────────────────────────────────────────────────────

import { EVENT_LABEL } from './notificationCatalog.js';

const BRAND = {
  name: 'BygSmart',
  primary: '#1E5FFF',
  ink: '#0F172A',
  muted: '#64748B',
  bg: '#F1F5F9',
  card: '#FFFFFF',
  appUrl: 'https://app.bygsmart.com',
  supportEmail: 'support@bygsmart.com',
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]),
  );

// Normalise an in-app link (e.g. '#/home', '/projects', '/project-detail/x?t=1')
// into a full HashRouter URL: https://app.bygsmart.com/#/<route>.
export const toAppUrl = (link) => {
  if (!link) return `${BRAND.appUrl}/#/home`;
  let l = String(link).trim();
  if (l.startsWith('http')) return l; // already absolute
  if (l.startsWith('#')) l = l.replace(/^#+/, ''); // '#/home' -> '/home'
  if (!l.startsWith('/')) l = `/${l}`;
  return `${BRAND.appUrl}/#${l}`;
};

const NOTIFICATION_SETTINGS_URL = `${BRAND.appUrl}/#/settings/notifications`;

// ─────────────────────────────────────────────────────────────────────────────
// HTML layout
// ─────────────────────────────────────────────────────────────────────────────
function renderHtml({ heading, greetingName, bodyLines, ctaLabel, ctaUrl, previewText, showManageLink }) {
  const greeting = greetingName ? `Hej ${escapeHtml(greetingName)},` : 'Hej,';
  const paragraphs = (bodyLines || [])
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.ink};">${escapeHtml(line)}</p>`,
    )
    .join('');

  const cta = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
         <tr><td style="border-radius:10px;background:${BRAND.primary};">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel || 'Åbn i BygSmart')}</a>
         </td></tr>
       </table>`
    : '';

  const manage = showManageLink
    ? `Du kan til- og fravælge disse e-mails under <a href="${NOTIFICATION_SETTINGS_URL}" style="color:${BRAND.primary};text-decoration:none;">E-mail notifikationer</a> i dine indstillinger.`
    : '';

  return `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(previewText || heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:8px 8px 20px;">
        <span style="font-size:20px;font-weight:800;letter-spacing:.5px;color:${BRAND.primary};">BYG&nbsp;SMART</span>
      </td></tr>
      <tr><td style="background:${BRAND.card};border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:${BRAND.ink};">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.ink};">${greeting}</p>
        ${paragraphs}
        ${cta}
      </td></tr>
      <tr><td style="padding:20px 12px;font-size:13px;line-height:1.6;color:${BRAND.muted};">
        ${manage ? `<p style="margin:0 0 10px;">${manage}</p>` : ''}
        <p style="margin:0;">Med venlig hilsen,<br>BygSmart · <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.muted};">${BRAND.supportEmail}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain-text fallback
// ─────────────────────────────────────────────────────────────────────────────
function renderText({ heading, greetingName, bodyLines, ctaLabel, ctaUrl, showManageLink }) {
  const lines = [];
  lines.push(heading);
  lines.push('');
  lines.push(greetingName ? `Hej ${greetingName},` : 'Hej,');
  lines.push('');
  (bodyLines || []).filter(Boolean).forEach((l) => lines.push(l));
  if (ctaUrl) {
    lines.push('');
    lines.push(`${ctaLabel || 'Åbn i BygSmart'}: ${ctaUrl}`);
  }
  if (showManageLink) {
    lines.push('');
    lines.push(`Til- og fravælg disse e-mails: ${NOTIFICATION_SETTINGS_URL}`);
  }
  lines.push('');
  lines.push('Med venlig hilsen, BygSmart');
  lines.push(BRAND.supportEmail);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable branded layout — shared by notification + billing emails.
// Returns { html, text } for a given set of body lines + optional CTA.
// ─────────────────────────────────────────────────────────────────────────────
export function renderBrandedEmail({ heading, greetingName, bodyLines, ctaLabel, ctaUrl, previewText, showManageLink }) {
  return {
    html: renderHtml({ heading, greetingName, bodyLines, ctaLabel, ctaUrl, previewText, showManageLink }),
    text: renderText({ heading, greetingName, bodyLines, ctaLabel, ctaUrl, showManageLink }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildEmail({ eventKey, notification, recipientName }) {
  const heading = EVENT_LABEL[eventKey] || 'Ny notifikation fra BygSmart';
  const subject = `${heading} · BygSmart`;
  const bodyLines = [notification?.text].filter(Boolean);
  const ctaUrl = toAppUrl(notification?.link);
  const common = { heading, greetingName: recipientName, bodyLines, showManageLink: true };

  return {
    subject,
    html: renderHtml({ ...common, ctaLabel: 'Åbn i BygSmart', ctaUrl, previewText: bodyLines[0] || heading }),
    text: renderText({ ...common, ctaUrl }),
  };
}
