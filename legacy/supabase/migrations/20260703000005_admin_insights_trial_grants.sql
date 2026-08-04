-- Admin insights, Phase 5: admin-granted trials.
-- Additive migration — four new nullable columns on profiles, no changes to
-- existing columns. A trial is an app-side tier OVERLAY, never a write to
-- subscription_tier itself: subscription_tier remains exclusively
-- Stripe-verified truth (see 20260609000001_stripe_backed_team_tier.sql,
-- which explicitly guards against unpaid tier grants leaking into that
-- column and propagating to team members). Effective tier is computed as
-- max(subscription_tier, trial_tier) while trial_ends_at is in the future —
-- see getEffectiveTier() in server/index.js and mapProfileToUser() in
-- contexts/AuthProvider.tsx, the two places that now read it.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS trial_tier text
        CHECK (trial_tier IS NULL OR trial_tier IN ('PRO', 'PREMIUM', 'ENTERPRISE')),
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS trial_granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trial_granted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at
    ON public.profiles(trial_ends_at)
    WHERE trial_ends_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Guard: the existing "profiles_update_own" RLS policy
-- (USING (auth.uid() = id), no WITH CHECK / column restriction) lets an
-- authenticated user update ANY column on their own row via the client SDK —
-- including, without this guard, the four trial columns just added. That
-- would let a user grant themselves an ENTERPRISE trial directly from a
-- browser console, bypassing the admin-only PATCH endpoint entirely.
--
-- This trigger forces those four columns back to their prior value whenever
-- the update is made in an authenticated end-user context (auth.uid() IS NOT
-- NULL). Service-role writes — i.e. the admin API server, which is the only
-- intended writer — run with auth.uid() IS NULL and pass through untouched.
-- All other profile self-edit flows (name, phone, job_title, cvr, …) are
-- unaffected: this trigger only ever touches the four trial_* columns.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_trial_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        NEW.trial_tier := OLD.trial_tier;
        NEW.trial_ends_at := OLD.trial_ends_at;
        NEW.trial_granted_by := OLD.trial_granted_by;
        NEW.trial_granted_at := OLD.trial_granted_at;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_trial_columns ON public.profiles;
CREATE TRIGGER profiles_protect_trial_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_trial_columns();
