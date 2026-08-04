// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook handler.
//
// Mounted from server/index.js via:
//   app.use(createStripeWebhookRouter({ stripe, stripeWebhookSecret, supabaseAdmin,
//                                       isProduction, resolveTierFromPriceId, maxTier }))
//
// IMPORTANT: the raw-body parser for this path —
//   app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }))
// — MUST stay in index.js, registered before express.json(), so Stripe
// signature verification (stripe.webhooks.constructEvent) still receives the
// untouched request body. This module only owns the POST handler itself.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { resolveSmtpConfig, sendMail } from '../email.js';
import {
  buildReceiptEmail,
  buildPaymentFailedEmail,
  buildSubscriptionCanceledEmail,
  buildTrialEndingEmail,
} from '../billingEmails.js';

export const createStripeWebhookRouter = ({
  stripe,
  stripeWebhookSecret,
  supabaseAdmin,
  isProduction,
  resolveTierFromPriceId,
  maxTier,
}) => {
  const router = Router();

  // Best-effort mandatory billing email. Resolves the recipient from the Stripe
  // customer id (profiles.stripe_customer_id), falling back to a Stripe-supplied
  // email. Never throws — a mail failure must never fail the webhook (which would
  // make Stripe retry and risk double-charging logic / duplicate emails).
  const sendBillingEmail = async ({ customerId, fallbackEmail, build }) => {
    try {
      let email = fallbackEmail || null;
      let name = '';
      if (customerId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('name, email')
          .eq('stripe_customer_id', String(customerId))
          .maybeSingle();
        if (profile) {
          email = profile.email || email;
          name = profile.name || '';
        }
      }
      if (!email) return;
      if (!name) name = email.split('@')[0];

      const smtp = await resolveSmtpConfig({ supabaseAdmin, ownerId: null });
      if (!smtp) return; // global SMTP not configured — nothing to send through

      const { subject, html, text } = build(name);
      await sendMail({ transportOptions: smtp, to: email, subject, html, text });
    } catch (err) {
      console.error('[stripe-webhook] billing email failed:', err?.message ?? err);
    }
  };

  router.post('/api/stripe-webhook', async (req, res) => {
    if (!stripe || !stripeWebhookSecret) {
      res.status(500).send('Stripe webhook not configured');
      return;
    }

    let event;
    try {
      const signature = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown webhook error';
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    if (!supabaseAdmin) {
      res.status(500).send('Supabase server credentials are not configured');
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerId = session.customer;
        const userId = session.metadata?.user_id;

        if (customerId && userId) {
          await supabaseAdmin
            .from('profiles')
            .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq('id', userId);
        }
      }

      if (
        (event.type === 'customer.subscription.created' ||
          event.type === 'customer.subscription.updated' ||
          event.type === 'customer.subscription.deleted') &&
        // Module/storage-addon subscriptions are org entitlement purchases,
        // not plan-tier changes — they must NEVER reach the tier sync below:
        // an unrecognized (module/storage) price resolves to FREE via
        // resolveTierFromPriceId and would reset the customer's real plan
        // tier (+ propagate FREE to their whole team). The Supabase edge
        // function (supabase/functions/stripe-webhook) already guards this
        // exact hazard for its own copy of this logic — mirrored here.
        event.data.object.metadata?.kind !== 'module' &&
        event.data.object.metadata?.kind !== 'storage'
      ) {
        const subscription = event.data.object;
        const customerId = String(subscription.customer);
        const subscriptionId = subscription.id;

        const status = subscription.status;
        let tier = 'FREE';
        if (status === 'active' || status === 'trialing') {
          const prices = subscription.items?.data || [];
          tier = prices.reduce((acc, item) => {
            const priceTier = resolveTierFromPriceId(item.price?.id);
            return maxTier(acc, priceTier);
          }, 'FREE');
        }

        // Update the leader's own profile tier
        const { data: updatedLeaders } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: tier,
            stripe_subscription_id: status === 'canceled' ? null : subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
          .select('id');

        // Propagate tier to all team members whose subscription is backed by this leader.
        // A team member's tier is only valid while the leader's Stripe sub is active.
        // When the leader's sub changes or cancels, members sync to the new tier (or FREE).
        if (updatedLeaders && updatedLeaders.length > 0) {
          const leaderId = updatedLeaders[0].id;

          // Find the leader's team
          const { data: leaderTeam } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('leader_id', leaderId)
            .maybeSingle();

          if (leaderTeam) {
            // Update all active team seat members to mirror the leader's resolved tier
            await supabaseAdmin
              .from('profiles')
              .update({
                subscription_tier: tier,
                updated_at: new Date().toISOString(),
              })
              .eq('team_id', leaderTeam.id)
              .neq('id', leaderId); // don't re-update the leader
          }
        }
      }

      // ── Mandatory billing emails (best-effort, never fail the webhook) ───────
      // Requires these events to be enabled on the Stripe webhook endpoint:
      // invoice.paid, invoice.payment_failed, customer.subscription.trial_will_end.
      // (customer.subscription.deleted is already enabled for the tier logic above.)
      if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        if ((invoice.amount_paid ?? 0) > 0) {
          await sendBillingEmail({
            customerId: invoice.customer,
            fallbackEmail: invoice.customer_email,
            build: (name) => buildReceiptEmail(invoice, name),
          });
        }
      } else if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        await sendBillingEmail({
          customerId: invoice.customer,
          fallbackEmail: invoice.customer_email,
          build: (name) => buildPaymentFailedEmail(invoice, name),
        });
      } else if (event.type === 'customer.subscription.trial_will_end') {
        const subscription = event.data.object;
        await sendBillingEmail({
          customerId: subscription.customer,
          build: (name) => buildTrialEndingEmail(subscription, name),
        });
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        await sendBillingEmail({
          customerId: subscription.customer,
          build: (name) => buildSubscriptionCanceledEmail(name),
        });
      }

      res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[api/stripe-webhook] error:', message);
      res
        .status(500)
        .json({ error: 'Webhook processing failed', details: isProduction ? undefined : message });
    }
  });

  return router;
};
