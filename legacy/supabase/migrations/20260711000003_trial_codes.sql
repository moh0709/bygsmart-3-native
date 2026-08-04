-- Shareable free-trial codes (app-managed).
--
-- Stripe has native coupons/promotion codes for DISCOUNTS, but no concept of a
-- "trial code". These rows let admins mint shareable codes that grant a free
-- trial at checkout: either a fixed number of days (trial_days) OR until a
-- specific date (trial_until). The checkout endpoint (billingRoutes.js) reads
-- the matching row (service role) and sets subscription_data.trial_period_days
-- or trial_end on the Stripe Checkout Session, then increments redeemed_count.

CREATE TABLE IF NOT EXISTS public.trial_codes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE,               -- stored uppercased
    trial_days      integer CHECK (trial_days IS NULL OR (trial_days BETWEEN 1 AND 365)),
    trial_until     timestamptz,
    max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    redeemed_count  integer NOT NULL DEFAULT 0,
    expires_at      timestamptz,                        -- the code itself stops working after this
    active          boolean NOT NULL DEFAULT true,
    note            text,
    created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    -- Exactly one of trial_days / trial_until must be provided.
    CONSTRAINT trial_codes_one_kind
      CHECK (((trial_days IS NOT NULL))::int + ((trial_until IS NOT NULL))::int = 1)
);

ALTER TABLE public.trial_codes ENABLE ROW LEVEL SECURITY;

-- Admins manage codes directly; the API server uses the service role (bypasses
-- RLS) for validation + redemption at checkout.
CREATE POLICY "trial_codes_admin_all" ON public.trial_codes
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'admin')
    );
