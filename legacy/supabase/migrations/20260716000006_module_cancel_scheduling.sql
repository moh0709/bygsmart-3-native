-- Native in-app module cancel (graceful, period-end) — adds the columns the
-- Stripe webhook needs to persist so the UI can show "ophører d. {date}" and
-- support an undo, without an extra Stripe round-trip per page load.
--
-- stripe_subscription_id: the existing stripe_subscription_item_id column
-- stores the Stripe SUBSCRIPTION ITEM id (si_...), not the subscription id
-- (sub_...) needed to call stripe.subscriptions.update() — nothing in the
-- app reads that column today (write-only from the webhook), so this adds
-- the real subscription id alongside it rather than repurposing it.
ALTER TABLE public.org_module_entitlements
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;
