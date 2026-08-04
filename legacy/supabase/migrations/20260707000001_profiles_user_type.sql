-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.user_type — per-user classification that drives Stripe test-vs-live.
--
--   normal (default) · test · partner · admin
--
-- Stripe mode selection (server-side, billingRoutes): user_type IN ('test','admin')
-- → Stripe TEST keys; ('normal','partner') → LIVE keys. This lets us run test and
-- live checkout simultaneously on the same production deployment.
--
-- SECURITY: user_type MUST be settable only by the service-role admin API. If an
-- authenticated end user could self-assign 'test' (or 'admin'), they'd get
-- test-mode checkout — i.e. a free PRO/PREMIUM subscription with a test card — or
-- sync themselves to admin. So we extend the existing protect_trial_columns()
-- BEFORE-UPDATE guard (20260703000007) to freeze user_type for end-user writes,
-- exactly as it already freezes app_role / stripe_customer_id / is_demo.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Column + value constraint + default. Matches the app_role style
--    (text NOT NULL DEFAULT ...) from 20260606000000.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'normal'
    CHECK (user_type IN ('normal', 'test', 'partner', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- 2. Backfill: existing platform admins reflect as 'admin' in the new dropdown.
--    (Runs as the migration/service role — auth.uid() IS NULL — so the guard
--    below passes it through.)
UPDATE public.profiles SET user_type = 'admin' WHERE app_role = 'admin';

-- 3. Freeze user_type against end-user self-writes. This is a CREATE OR REPLACE of
--    the LIVE protect_trial_columns() body from 20260703000007, with ONLY the
--    user_type freeze line added — every other line is unchanged.
CREATE OR REPLACE FUNCTION public.protect_trial_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        -- Admin-granted trial overlay — service-role admin API only.
        NEW.trial_tier := OLD.trial_tier;
        NEW.trial_ends_at := OLD.trial_ends_at;
        NEW.trial_granted_by := OLD.trial_granted_by;
        NEW.trial_granted_at := OLD.trial_granted_at;

        -- Platform admin flag — the authorization gate for the whole admin
        -- surface. Only the service-role admin API (auth.uid() IS NULL) may
        -- ever change it. Never settable by an end user.
        NEW.app_role := OLD.app_role;

        -- User classification (normal/test/partner/admin). Drives Stripe test-vs-
        -- live mode, so an end-user self-write of 'test'/'admin' would grant free
        -- test-mode subscriptions. Settable only by the service-role admin API.
        NEW.user_type := OLD.user_type;

        -- Demo status is set exclusively by the demo/claim service-role flows.
        NEW.is_demo := OLD.is_demo;

        -- Stripe identity is written only by the checkout/webhook service role.
        NEW.stripe_customer_id := OLD.stripe_customer_id;
        NEW.stripe_subscription_id := OLD.stripe_subscription_id;

        -- Team membership is written only by accept_team_invite()/handle_new_user().
        -- accept_team_invite() opts in via the flag below; everything else (a
        -- direct client UPDATE) is frozen.
        IF current_setting('app.privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
            NEW.team_id := OLD.team_id;
            NEW.team_role := OLD.team_role;
        END IF;

        -- company_id is derived by link_profile_company() strictly from cvr /
        -- company_name. Allow it to change only when one of those source columns
        -- is also changing in this same UPDATE; otherwise a direct company_id
        -- self-assign (to read a victim company row) is frozen.
        IF NEW.company_id IS DISTINCT FROM OLD.company_id
           AND NEW.cvr IS NOT DISTINCT FROM OLD.cvr
           AND NEW.company_name IS NOT DISTINCT FROM OLD.company_name THEN
            NEW.company_id := OLD.company_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
