// ─────────────────────────────────────────────────────────────────────────────
// Stripe checkout / customer-portal routes.
//
// Mounted from server/index.js via:
//   app.use(createBillingRouter({ stripe, supabaseAdmin, getAuthenticatedUser,
//                                 normalizeTier, getPriceId, sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { isDemoUser } from '../demoAccess.js';
import { buildSeatBillingDetails } from '../billingSync.js';
import { resolveTrialCode } from './promoCodeRoutes.js';

export const createBillingRouter = ({
  getStripe,
  stripeModeForUserType,
  supabaseAdmin,
  getAuthenticatedUser,
  normalizeTier,
  getPriceId,
  sensitiveLimiter,
}) => {
  const router = Router();

  router.post('/api/create-checkout-session', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Supabase server credentials are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (isDemoUser(user)) {
      res.status(403).json({ error: 'Demo accounts cannot start checkout.' });
      return;
    }

    const requestedTier = normalizeTier(req.body?.tier);
    if (!['PRO', 'PREMIUM'].includes(requestedTier)) {
      res.status(400).json({ error: 'Unsupported tier for checkout.' });
      return;
    }

    const billing = req.body?.billing === 'yearly' ? 'yearly' : 'monthly';

    const [
      { data: profile, error: profileError },
      { data: checkoutTeam },
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, email, stripe_customer_id, subscription_tier, user_type')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('teams')
        .select('id, name')
        .eq('leader_id', user.id)
        .maybeSingle(),
    ]);

    if (profileError || !profile) {
      res.status(404).json({ error: 'User profile was not found.' });
      return;
    }

    // Stripe mode chosen by the user's classification (test/admin -> test keys).
    const mode = stripeModeForUserType(profile.user_type);
    const stripe = getStripe(mode);
    if (!stripe) {
      res.status(500).json({ error: `Stripe ${mode} mode is not configured on server.` });
      return;
    }

    const priceId = getPriceId(mode, requestedTier, billing);
    if (!priceId) {
      res.status(500).json({ error: `Stripe ${mode} price is not configured for tier ${requestedTier} (${billing}).` });
      return;
    }

    // Optional free-trial code → adds trial params to the subscription. Validated
    // here so an invalid code fails the checkout with a clear message.
    let trialParams = {};
    let redeemedTrial = null;
    if (req.body?.trialCode) {
      const t = await resolveTrialCode(supabaseAdmin, req.body.trialCode);
      if (!t.valid) {
        res.status(400).json({ error: t.reason || 'Ugyldig prøvekode.' });
        return;
      }
      if (t.row.trial_days) {
        trialParams = { trial_period_days: t.row.trial_days };
      } else if (t.row.trial_until) {
        const trialEnd = Math.floor(new Date(t.row.trial_until).getTime() / 1000);
        if (trialEnd > Math.floor(Date.now() / 1000) + 60) {
          trialParams = { trial_end: trialEnd };
        }
      }
      redeemedTrial = t.row;
    }

    let session;
    try {
      let customerId = profile.stripe_customer_id;

      // Verify the stored customer exists in THIS Stripe mode. A customer created
      // under a different mode (legacy single-key data, or after the user's
      // user_type changed) won't exist here and would 404 — recreate in that case.
      if (customerId) {
        try {
          const existing = await stripe.customers.retrieve(customerId);
          if (existing?.deleted) customerId = null;
        } catch (err) {
          if (err?.code === 'resource_missing') customerId = null;
          else throw err;
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: profile.email || user.email || undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;

        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      let checkoutSeats = [];
      if (checkoutTeam) {
        const { data: seatRows, error: seatsError } = await supabaseAdmin
          .from('team_seats')
          .select('id, email, status, profile_id, subscription_tier, created_at')
          .eq('team_id', checkoutTeam.id)
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: true });

        if (seatsError) {
          res.status(500).json({ error: 'Unable to load team seats for checkout.' });
          return;
        }

        checkoutSeats = seatRows ?? [];
      }

      const billingDetails = buildSeatBillingDetails({
        leaderEmail: profile.email || user.email || '',
        teamName: checkoutTeam?.name ?? '',
        seats: checkoutSeats,
      });

      await stripe.customers.update(customerId, {
        invoice_settings: {
          custom_fields: billingDetails.invoiceCustomFields,
        },
      });

      const origin = process.env.ALLOWED_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000';
      const successUrl = req.body?.successUrl || `${origin}/#/settings?billing=success`;
      const cancelUrl = req.body?.cancelUrl || `${origin}/#/settings?billing=cancelled`;

      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: billingDetails.quantity }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: user.id,
          requested_tier: requestedTier,
          billing,
          billable_seat_count: billingDetails.metadata.billable_seat_count,
        },
        subscription_data: {
          description: billingDetails.description,
          metadata: billingDetails.metadata,
          ...trialParams,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });
    } catch (err) {
      console.error('[api/create-checkout-session] Stripe error:', err?.message);
      res.status(502).json({ error: 'Kunne ikke oprette betaling. Prøv igen om lidt.' });
      return;
    }

    // Count the trial-code redemption (best-effort). Non-atomic + at session
    // creation, so max_redemptions is a soft cap — acceptable for promo codes.
    if (redeemedTrial) {
      try {
        await supabaseAdmin
          .from('trial_codes')
          .update({ redeemed_count: (redeemedTrial.redeemed_count ?? 0) + 1 })
          .eq('id', redeemedTrial.id);
      } catch (incErr) {
        console.error('[api/create-checkout-session] trial redemption count failed:', incErr?.message ?? incErr);
      }
    }

    res.status(200).json({ url: session.url, id: session.id });
  });

  // Customer portal — lets users manage/cancel their own subscription via Stripe-hosted UI
  router.post('/api/create-portal-session', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, user_type')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile?.stripe_customer_id) {
      res.status(404).json({ error: 'No Stripe customer found for this user.' });
      return;
    }

    // Portal must use the same Stripe mode the customer was created in.
    const mode = stripeModeForUserType(profile.user_type);
    const stripe = getStripe(mode);
    if (!stripe) {
      res.status(500).json({ error: `Stripe ${mode} mode is not configured on server.` });
      return;
    }

    const origin = process.env.ALLOWED_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000';
    const returnUrl = req.body?.returnUrl || `${origin}/#/settings?billing=portal`;

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: returnUrl,
      });
      res.status(200).json({ url: portalSession.url });
    } catch (err) {
      if (err?.code === 'resource_missing') {
        res.status(404).json({ error: 'No Stripe customer found for this user.' });
        return;
      }
      console.error('[api/create-portal-session] Stripe error:', err?.message);
      res.status(502).json({ error: 'Kunne ikke åbne kundeportalen. Prøv igen.' });
    }
  });

  return router;
};
