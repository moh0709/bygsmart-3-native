-- ============================================================================
-- BygSmart 3.0 Native — Per-platform push subscriptions (P2 2.4)
-- ============================================================================
-- The baseline push_subscriptions is web-only (endpoint + VAPID subscription
-- jsonb). The three-provider push abstraction needs native rows too, keyed by an
-- Expo push token. One row per (user, device); web is keyed by endpoint, native
-- by token.
-- ============================================================================

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'ios', 'android')),
  ADD COLUMN IF NOT EXISTS token text;

-- Web supplies endpoint + subscription; native supplies token instead.
ALTER TABLE public.push_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN subscription DROP NOT NULL;

-- Native identity: one row per Expo push token.
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_token
  ON public.push_subscriptions (token) WHERE token IS NOT NULL;

-- Shape integrity: web needs endpoint+subscription; native needs a token.
DO $$ BEGIN
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_shape CHECK (
    (platform = 'web' AND endpoint IS NOT NULL AND subscription IS NOT NULL)
    OR (platform IN ('ios', 'android') AND token IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
