// ─────────────────────────────────────────────────────────────────────────────
// Daily trial-ending reminder job (app-level / admin-granted trials only).
//
// Stripe-backed trials are reminded by the customer.subscription.trial_will_end
// webhook (see stripeWebhookRoutes.js). This job covers trials granted inside the
// app (profiles.trial_tier + trial_ends_at, no Stripe subscription): it emails
// everyone whose trial ends within the next 3 days and hasn't been reminded yet,
// then stamps profiles.trial_reminded_at so each trial is reminded at most once.
//
// Run from the backend directory, e.g. via cron:
//   0 9 * * *  cd ~/nodeapp/bygsmart_server && /usr/bin/node jobs/trialReminders.js >> ~/logs/trial_reminders.log 2>&1
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getServerEnvOptions } from '../env.js';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { renderBrandedEmail } from '../emailTemplates.js';

dotenv.config(getServerEnvOptions());

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.error('[trialReminders] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exitCode = 1;
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: rows, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, trial_ends_at')
    .not('trial_tier', 'is', null) // has an app-level trial
    .is('stripe_subscription_id', null) // NOT a Stripe-backed trial
    .is('trial_reminded_at', null) // not yet reminded
    .not('email', 'is', null)
    .gt('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', windowEnd.toISOString());

  if (error) {
    console.error('[trialReminders] query error:', error.message);
    process.exitCode = 1;
    return;
  }
  if (!rows || rows.length === 0) {
    console.log(`[trialReminders] ${now.toISOString()} — no trials to remind`);
    return;
  }

  const smtp = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
  if (!smtp) {
    console.error('[trialReminders] no global SMTP configured — skipping');
    process.exitCode = 1;
    return;
  }

  let sent = 0;
  for (const p of rows) {
    try {
      const endDate = p.trial_ends_at
        ? new Date(p.trial_ends_at).toLocaleDateString('da-DK', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : null;
      const name = p.name || (p.email ? p.email.split('@')[0] : '');

      const { html, text } = renderBrandedEmail({
        heading: 'Din prøveperiode slutter snart',
        greetingName: name,
        bodyLines: [
          endDate
            ? `Din gratis prøveperiode udløber den ${endDate}.`
            : 'Din gratis prøveperiode udløber snart.',
          'Vælg en plan for at beholde dine funktioner uden afbrydelse.',
        ],
        ctaLabel: 'Vælg en plan',
        ctaUrl: 'https://app.bygsmart.com/#/settings',
        previewText: 'Din prøveperiode slutter snart',
        showManageLink: false,
      });

      const result = await sendMail({
        transportOptions: smtp,
        to: p.email,
        subject: 'Din prøveperiode udløber snart · BygSmart',
        html,
        text,
      });

      if (result.ok) {
        // Mark reminded only on a successful send so transient SMTP failures
        // get retried on the next daily run.
        await supabaseAdmin
          .from('profiles')
          .update({ trial_reminded_at: new Date().toISOString() })
          .eq('id', p.id);
        sent += 1;
      } else {
        console.error(`[trialReminders] send failed for ${p.id}: ${result.error}`);
      }
    } catch (err) {
      console.error(`[trialReminders] error for ${p.id}:`, err?.message ?? err);
    }
  }

  console.log(`[trialReminders] ${now.toISOString()} — reminded ${sent}/${rows.length}`);
}

main().catch((err) => {
  console.error('[trialReminders] fatal:', err?.message ?? err);
  process.exitCode = 1;
});
