import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook receiver — Supabase Edge Function (BygSmart on simply.com).
// simply's WAF can block server-to-server callers, so the webhook lives here.
//
// One endpoint serves BOTH the live and test Stripe webhooks: it verifies against
// either signing secret and resolves tiers from either price set.
//
// The tier is granted on checkout.session.completed (which only fires on a PAID
// checkout) from session.metadata.requested_tier, because the first
// customer.subscription.created event usually arrives with status='incomplete'
// while the initial payment settles. Subscription events then keep the tier in
// sync (active -> price tier, canceled/deleted -> FREE); transient states
// (incomplete, past_due, ...) are ignored so a still-settling checkout is never
// downgraded to FREE.
//
// Secrets: STRIPE_WEBHOOK_SECRET_{TEST,LIVE}, STRIPE_PRICE_<TIER>_<PERIOD>_{TEST,LIVE}.
// verify_jwt=false. The Stripe API key is unused here (verify + DB writes only),
// but the SDK requires a non-empty key to construct — hence the placeholder.
// ─────────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(
  Deno.env.get('STRIPE_SECRET_KEY_LIVE') ||
    Deno.env.get('STRIPE_SECRET_KEY_TEST') ||
    Deno.env.get('STRIPE_SECRET_KEY') ||
    'sk_test_placeholder',
  { apiVersion: '2024-12-18.acacia' },
);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const PLAN_PRIORITY = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'] as const;
type Tier = typeof PLAN_PRIORITY[number];

const normalizeTier = (tier?: string | null): Tier => {
  if (!tier) return 'FREE';
  const upper = tier.toUpperCase();
  return (PLAN_PRIORITY as readonly string[]).includes(upper) ? (upper as Tier) : 'FREE';
};

const maxTier = (a?: string | null, b?: string | null): Tier => {
  const ai = PLAN_PRIORITY.indexOf(normalizeTier(a));
  const bi = PLAN_PRIORITY.indexOf(normalizeTier(b));
  return PLAN_PRIORITY[Math.max(ai, bi)] ?? 'FREE';
};

// Checks both the test and live price sets (plus legacy unsuffixed vars).
const resolveTierFromPriceId = (priceId?: string | null): Tier => {
  if (!priceId) return 'FREE';
  const idsFor = (tier: string) =>
    [
      Deno.env.get(`STRIPE_PRICE_${tier}_MONTHLY_TEST`),
      Deno.env.get(`STRIPE_PRICE_${tier}_YEARLY_TEST`),
      Deno.env.get(`STRIPE_PRICE_${tier}_MONTHLY_LIVE`),
      Deno.env.get(`STRIPE_PRICE_${tier}_YEARLY_LIVE`),
      Deno.env.get(`STRIPE_PRICE_${tier}_MONTHLY`),
      Deno.env.get(`STRIPE_PRICE_${tier}_YEARLY`),
    ].filter(Boolean) as string[];
  if (idsFor('PRO').includes(priceId) || ['price_pro_monthly', 'price_pro_yearly'].includes(priceId)) return 'PRO';
  if (idsFor('PREMIUM').includes(priceId) || ['price_premium_monthly', 'price_premium_yearly'].includes(priceId)) return 'PREMIUM';
  return 'FREE';
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  // Verify against BOTH signing secrets (live + test webhooks share this URL).
  const webhookSecrets = [
    Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET'),
  ].filter(Boolean) as string[];

  const body = await req.text();
  let event: Stripe.Event | null = null;
  let lastError = 'no configured signing secret matched';
  for (const secret of webhookSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown webhook error';
    }
  }
  if (!event) {
    console.error('[stripe-webhook] signature verification failed:', lastError);
    return new Response(`Webhook Error: ${lastError}`, { status: 400 });
  }

  try {
    // A completed checkout session is a confirmed payment — grant the purchased
    // tier immediately from metadata.requested_tier (the customer.subscription.
    // created event often arrives 'incomplete' while the first invoice settles).
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Storage add-on purchases update the org's allowance — never tiers.
      if (session.metadata?.kind === 'storage') {
        const orgId = session.metadata?.org_id;
        const extraGb = Number.parseInt(session.metadata?.extra_gb ?? '', 10);
        const paidStorage = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
        console.log(
          `[stripe-webhook] storage checkout completed org=${orgId} extraGb=${extraGb} payment_status=${session.payment_status}`,
        );
        if (paidStorage && orgId && Number.isInteger(extraGb) && extraGb > 0) {
          const { error: storageGrantError } = await supabase
            .from('organizations')
            .update({
              storage_allowance_gb: 5 + extraGb,
              storage_subscription_id: session.subscription ? String(session.subscription) : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orgId);
          if (storageGrantError) {
            console.error('[stripe-webhook] storage grant failed:', storageGrantError.message);
            return new Response('Database update failed', { status: 500 });
          }
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Module purchases (Phase 8) grant an org entitlement — they never touch
      // profiles/tiers. Handled first and returned early.
      if (session.metadata?.kind === 'module') {
        const orgId = session.metadata?.org_id;
        const moduleId = session.metadata?.module_id;
        const paidModule = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
        console.log(
          `[stripe-webhook] module checkout completed org=${orgId} module=${moduleId} payment_status=${session.payment_status}`,
        );
        if (paidModule && orgId && moduleId) {
          const { error: moduleGrantError } = await supabase.from('org_module_entitlements').upsert({
            org_id: orgId,
            module_id: moduleId,
            status: 'enabled',
            source: 'purchase',
            valid_until: null,
            stripe_subscription_item_id: session.subscription ? String(session.subscription) : null,
            stripe_subscription_id: session.subscription ? String(session.subscription) : null,
            note: 'Stripe-køb (marketplace)',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'org_id,module_id' });
          if (moduleGrantError) {
            console.error('[stripe-webhook] module grant failed:', moduleGrantError.message);
            return new Response('Database update failed', { status: 500 });
          }
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const customerId = session.customer ? String(session.customer) : null;
      const userId = session.metadata?.user_id;
      const paidTier = normalizeTier(session.metadata?.requested_tier);
      const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
      console.log(
        `[stripe-webhook] checkout.session.completed customer=${customerId} user=${userId ?? 'none'} tier=${paidTier} payment_status=${session.payment_status}`,
      );

      if (customerId && userId) {
        const update: Record<string, unknown> = {
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        };
        if (paid && paidTier !== 'FREE') update.subscription_tier = paidTier;
        await supabase.from('profiles').update(update).eq('id', userId);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;

      // Storage add-on subscriptions sync the org allowance (5 GB base +
      // quantity) and must never reach the tier sync. Guarded + early return.
      if (subscription.metadata?.kind === 'storage') {
        const orgId = subscription.metadata?.org_id;
        const subStatus = subscription.status;
        const storageCanceled = subStatus === 'canceled' || event.type === 'customer.subscription.deleted';
        const storageActive = subStatus === 'active' || subStatus === 'trialing';
        const quantity = subscription.items?.data?.[0]?.quantity ?? 0;
        console.log(
          `[stripe-webhook] storage subscription ${event.type} org=${orgId} status=${subStatus} qty=${quantity}`,
        );
        if (orgId) {
          if (storageCanceled) {
            const { error: storageResetError } = await supabase
              .from('organizations')
              .update({ storage_allowance_gb: 5, storage_subscription_id: null, updated_at: new Date().toISOString() })
              .eq('id', orgId);
            if (storageResetError) {
              console.error('[stripe-webhook] storage reset failed:', storageResetError.message);
              return new Response('Database update failed', { status: 500 });
            }
          } else if (storageActive && quantity > 0) {
            const { error: storageSyncError } = await supabase
              .from('organizations')
              .update({
                storage_allowance_gb: 5 + quantity,
                storage_subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orgId);
            if (storageSyncError) {
              console.error('[stripe-webhook] storage sync failed:', storageSyncError.message);
              return new Response('Database update failed', { status: 500 });
            }
          }
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Module subscriptions are org-entitlement purchases. They must NEVER
      // reach the tier sync below: an unknown (module) price resolves to FREE
      // and would reset a paying customer's tier. Guarded + early return.
      if (subscription.metadata?.kind === 'module') {
        const orgId = subscription.metadata?.org_id;
        const moduleId = subscription.metadata?.module_id;
        const subStatus = subscription.status;
        const moduleCanceled = subStatus === 'canceled' || event.type === 'customer.subscription.deleted';
        const moduleActive = subStatus === 'active' || subStatus === 'trialing';
        console.log(
          `[stripe-webhook] module subscription ${event.type} org=${orgId} module=${moduleId} status=${subStatus}`,
        );
        if (orgId && moduleId) {
          if (moduleCanceled) {
            // Fall back to the tier map: remove only the purchase row —
            // admin grants and trials are untouched.
            const { error: moduleDeleteError } = await supabase
              .from('org_module_entitlements')
              .delete()
              .eq('org_id', orgId)
              .eq('module_id', moduleId)
              .eq('source', 'purchase');
            if (moduleDeleteError) {
              console.error('[stripe-webhook] module purchase removal failed:', moduleDeleteError.message);
              return new Response('Database update failed', { status: 500 });
            }
          } else if (moduleActive) {
            const { error: moduleSyncError } = await supabase.from('org_module_entitlements').upsert({
              org_id: orgId,
              module_id: moduleId,
              status: 'enabled',
              source: 'purchase',
              valid_until: null,
              stripe_subscription_item_id: subscription.items?.data?.[0]?.id ?? subscription.id,
              stripe_subscription_id: subscription.id,
              cancel_at_period_end: subscription.cancel_at_period_end ?? false,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              note: 'Stripe-køb (marketplace)',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'org_id,module_id' });
            if (moduleSyncError) {
              console.error('[stripe-webhook] module sync failed:', moduleSyncError.message);
              return new Response('Database update failed', { status: 500 });
            }
          }
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const customerId = String(subscription.customer);
      const subscriptionId = subscription.id;
      const status = subscription.status;
      const priceIds = (subscription.items?.data ?? []).map((i) => i.price?.id);

      const isCanceled = status === 'canceled' || event.type === 'customer.subscription.deleted';
      const isActive = status === 'active' || status === 'trialing';

      // active/trialing -> tier from price; canceled/deleted -> FREE. Transient
      // states (incomplete, past_due, unpaid, ...) leave the tier untouched so a
      // still-settling checkout (granted on checkout.session.completed) is not
      // reset to FREE.
      let tier: Tier | null = null;
      if (isActive) {
        tier = priceIds.reduce<Tier>((acc, id) => maxTier(acc, resolveTierFromPriceId(id)), 'FREE');
      } else if (isCanceled) {
        tier = 'FREE';
      }

      console.log(
        `[stripe-webhook] ${event.type} status=${status} prices=[${priceIds.join(', ')}] -> tier=${tier ?? '(unchanged)'}`,
      );

      const update: Record<string, unknown> = {
        stripe_subscription_id: isCanceled ? null : subscriptionId,
        updated_at: new Date().toISOString(),
      };
      if (tier !== null) update.subscription_tier = tier;

      const { data: updatedLeaders, error: leaderError } = await supabase
        .from('profiles')
        .update(update)
        .eq('stripe_customer_id', customerId)
        .select('id');

      if (leaderError) {
        console.error('[stripe-webhook] leader update failed:', leaderError.message);
        return new Response('Database update failed', { status: 500 });
      }

      // Propagate the resolved tier to team members — only when the tier changed.
      if (tier !== null && updatedLeaders && updatedLeaders.length > 0) {
        const leaderId = updatedLeaders[0].id;
        const { data: leaderTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('leader_id', leaderId)
          .maybeSingle();

        if (leaderTeam) {
          await supabase
            .from('profiles')
            .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
            .eq('team_id', leaderTeam.id)
            .neq('id', leaderId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[stripe-webhook] processing error:', message);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
