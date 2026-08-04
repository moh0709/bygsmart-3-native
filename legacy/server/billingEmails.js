// ─────────────────────────────────────────────────────────────────────────────
// Mandatory billing emails (Danish) — receipts, dunning, cancellation, trial-end.
//
// These are MANDATORY (never toggleable) and are sent directly from the Stripe
// webhook handler via the global SMTP config — they do NOT consult
// notification_preferences. They reuse the shared branded layout.
// ─────────────────────────────────────────────────────────────────────────────

import { renderBrandedEmail } from './emailTemplates.js';

const APP_URL = 'https://app.bygsmart.com';
const SETTINGS_URL = `${APP_URL}/#/settings`;

// Stripe amounts are in the smallest currency unit (øre for DKK).
const fmtAmount = (amount, currency) =>
  `${((amount || 0) / 100).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${(currency || 'dkk').toUpperCase()}`;

const fmtDate = (unixSeconds) => {
  if (!unixSeconds) return null;
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
};

export function buildReceiptEmail(invoice, name) {
  const amount = fmtAmount(invoice.amount_paid ?? invoice.amount_due, invoice.currency);
  const periodStart = fmtDate(invoice.period_start);
  const periodEnd = fmtDate(invoice.period_end);
  const bodyLines = [
    'Tak — vi har modtaget din betaling for dit BygSmart-abonnement.',
    `Beløb: ${amount}`,
  ];
  if (periodStart && periodEnd) bodyLines.push(`Periode: ${periodStart} – ${periodEnd}`);
  if (invoice.number) bodyLines.push(`Faktura-nr.: ${invoice.number}`);

  const { html, text } = renderBrandedEmail({
    heading: 'Kvittering for din betaling',
    greetingName: name,
    bodyLines,
    ctaLabel: invoice.hosted_invoice_url ? 'Se faktura' : 'Åbn BygSmart',
    ctaUrl: invoice.hosted_invoice_url || SETTINGS_URL,
    previewText: `Kvittering: ${amount}`,
    showManageLink: false,
  });
  return { subject: 'Kvittering for din betaling · BygSmart', html, text };
}

export function buildPaymentFailedEmail(invoice, name) {
  const amount = fmtAmount(invoice.amount_due, invoice.currency);
  const bodyLines = [
    'Vi kunne desværre ikke gennemføre betalingen for dit BygSmart-abonnement.',
    `Beløb: ${amount}`,
    'Opdater din betalingsmetode, så du bevarer din adgang — vi forsøger automatisk igen.',
  ];
  const { html, text } = renderBrandedEmail({
    heading: 'Din betaling gik ikke igennem',
    greetingName: name,
    bodyLines,
    ctaLabel: 'Opdater betaling',
    ctaUrl: invoice.hosted_invoice_url || SETTINGS_URL,
    previewText: 'Handling påkrævet: opdater din betaling',
    showManageLink: false,
  });
  return { subject: 'Betaling mislykkedes · BygSmart', html, text };
}

export function buildSubscriptionCanceledEmail(name) {
  const bodyLines = [
    'Dit BygSmart-abonnement er nu afsluttet, og din konto er skiftet til Start-planen (gratis).',
    'Dine data er bevaret. Du er altid velkommen tilbage — vælg en plan igen, når det passer dig.',
  ];
  const { html, text } = renderBrandedEmail({
    heading: 'Dit abonnement er afsluttet',
    greetingName: name,
    bodyLines,
    ctaLabel: 'Vælg en plan',
    ctaUrl: SETTINGS_URL,
    previewText: 'Dit abonnement er afsluttet',
    showManageLink: false,
  });
  return { subject: 'Dit abonnement er afsluttet · BygSmart', html, text };
}

export function buildTrialEndingEmail(subscription, name) {
  const endDate = fmtDate(subscription.trial_end);
  const bodyLines = [
    endDate
      ? `Din gratis prøveperiode udløber den ${endDate}.`
      : 'Din gratis prøveperiode udløber snart.',
    'Herefter fortsætter dit abonnement automatisk. Du kan opsige eller ændre din plan når som helst.',
  ];
  const { html, text } = renderBrandedEmail({
    heading: 'Din prøveperiode slutter snart',
    greetingName: name,
    bodyLines,
    ctaLabel: 'Administrer abonnement',
    ctaUrl: SETTINGS_URL,
    previewText: 'Din prøveperiode slutter snart',
    showManageLink: false,
  });
  return { subject: 'Din prøveperiode udløber snart · BygSmart', html, text };
}
