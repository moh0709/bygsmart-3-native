-- Notification preferences — per-user opt-in/opt-out for the OPTIONAL email &
-- push notification events surfaced in Settings → "E-mail notifikationer".
--
-- MANDATORY events (billing/Stripe receipts, payment-failed, and the security
-- notices handled by Supabase Auth) are intentionally NOT represented here — they
-- are always delivered and never appear as a toggle. The delivery engine
-- (server/notifications.js, Phase 2) bypasses this table for mandatory events.
--
-- DEFAULT-ON MODEL: the ABSENCE of a row means "both channels enabled". A user
-- only gets rows once they toggle something off (or a later bulk write). The app
-- and server therefore treat "no row" as { email: true, push: true }. This keeps
-- the table small and makes new event types opt-in-by-default automatically.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notification_preferences — one row per (user, event_key) once customised
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_key     text NOT NULL,
    email_enabled boolean NOT NULL DEFAULT true,
    push_enabled  boolean NOT NULL DEFAULT true,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_key)
);

-- Fast lookup of one user's whole preference set (settings page load).
CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
    ON public.notification_preferences (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — a user may read and write only their own preference rows.
--    The API server uses the service role (bypasses RLS) when deciding whether
--    to deliver; these policies guard direct client access from the app.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_own" ON public.notification_preferences
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-update updated_at (reuses public.set_updated_at() from
--    20260606000000_admin_company_role.sql)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_set_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
