// ─────────────────────────────────────────────────────────────────────────────
// Notification delivery webhook.
//
// A Supabase Database Webhook fires on every INSERT into public.notifications and
// POSTs the row here. This endpoint is the SINGLE fan-out point that turns an
// in-app notification into email + web-push, honouring the recipient's
// preferences (notification_preferences; absent row = both channels ON).
//
// Security: authenticated by a shared secret header (x-webhook-secret) matched
// against NOTIFICATION_WEBHOOK_SECRET. If the secret is unset the endpoint is
// disabled (503) — fail closed so nobody can trigger mail without it.
//
// Push reconciliation: events already pushed at insert time by notifyUserAndPush
// (PUSHED_AT_INSERT_TYPES) are emailed here but NOT pushed again.
//
// Mounted from server/index.js via:
//   app.use(createNotificationDeliveryRouter({
//     supabaseAdmin, webpush, vapidPublicKey, vapidPrivateKey }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import { eventKeyForType, PUSHED_AT_INSERT_TYPES } from '../notificationCatalog.js';
import { buildEmail } from '../emailTemplates.js';

export const createNotificationDeliveryRouter = ({
  supabaseAdmin,
  webpush,
  vapidPublicKey,
  vapidPrivateKey,
}) => {
  const router = Router();
  const secret = process.env.NOTIFICATION_WEBHOOK_SECRET || '';

  router.post('/api/notifications/deliver', async (req, res) => {
    if (!secret) {
      res.status(503).json({ error: 'Notification delivery is not configured.' });
      return;
    }
    if ((req.get('x-webhook-secret') || '') !== secret) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Server not configured.' });
      return;
    }

    // Supabase Database Webhook payload: { type, table, schema, record, old_record }
    const body = req.body || {};
    const record = body.record;
    if (body.type !== 'INSERT' || body.table !== 'notifications' || !record?.user_id) {
      res.status(200).json({ skipped: 'not-a-notification-insert' });
      return;
    }

    const eventKey = eventKeyForType(record.type);
    if (!eventKey) {
      // Unmapped types (info/admin/task_checkin/…) stay in-app only.
      res.status(200).json({ skipped: 'unmapped-type', type: record.type });
      return;
    }

    // Preferences — absence of a row means both channels enabled (default ON).
    let emailEnabled = true;
    let pushEnabled = true;
    try {
      const { data: pref } = await supabaseAdmin
        .from('notification_preferences')
        .select('email_enabled, push_enabled')
        .eq('user_id', record.user_id)
        .eq('event_key', eventKey)
        .maybeSingle();
      if (pref) {
        emailEnabled = pref.email_enabled !== false;
        pushEnabled = pref.push_enabled !== false;
      }
    } catch {
      /* default ON on lookup failure */
    }

    // Recipient identity.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', record.user_id)
      .maybeSingle();
    const toEmail = profile?.email || null;
    const toName = profile?.name || (toEmail ? toEmail.split('@')[0] : '');

    const result = { eventKey, email: 'skipped', push: 'skipped' };

    // ── Email ────────────────────────────────────────────────────────────────
    if (!emailEnabled) {
      result.email = 'opted-out';
    } else if (!toEmail) {
      result.email = 'no-recipient';
    } else {
      try {
        const smtp = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
        if (!smtp) {
          result.email = 'no-smtp';
        } else {
          const { subject, html, text } = buildEmail({ eventKey, notification: record, recipientName: toName });
          const sent = await sendMail({ transportOptions: smtp, to: toEmail, subject, html, text });
          result.email = sent.ok ? 'sent' : `failed:${sent.error || 'unknown'}`;
        }
      } catch (err) {
        console.error('[notifications/deliver] email error:', err?.message ?? err);
        result.email = 'error';
      }
    }

    // ── Push ─────────────────────────────────────────────────────────────────
    if (!pushEnabled) {
      result.push = 'opted-out';
    } else if (PUSHED_AT_INSERT_TYPES.has(record.type)) {
      result.push = 'already-pushed';
    } else if (!vapidPublicKey || !vapidPrivateKey) {
      result.push = 'no-vapid';
    } else {
      try {
        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', record.user_id);
        if (!subs || subs.length === 0) {
          result.push = 'no-subscription';
        } else {
          const payload = JSON.stringify({
            title: 'BygSmart',
            body: record.text || 'Du har en ny notifikation.',
            url: record.link || '/#/home',
          });
          await Promise.allSettled(subs.map((row) => webpush.sendNotification(row.subscription, payload)));
          result.push = 'sent';
        }
      } catch (err) {
        console.error('[notifications/deliver] push error:', err?.message ?? err);
        result.push = 'error';
      }
    }

    res.status(200).json({ ok: true, ...result });
  });

  return router;
};
