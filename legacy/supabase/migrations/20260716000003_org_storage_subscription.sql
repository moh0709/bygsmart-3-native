-- Storage add-on (25 kr/GB/md.): track the org's Stripe storage subscription
-- so the webhook can sync storage_allowance_gb = 5 (base) + quantity.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS storage_subscription_id text;
