-- ============================================================
-- MIGRATION: close an account-enumeration hole flagged by the
-- Supabase security advisor immediately after
-- 20260710000005_task_member_lookup_rpcs.sql shipped.
--
-- Postgres grants EXECUTE to PUBLIC by default on function
-- creation; the earlier migration only ADDED a grant to
-- `authenticated` without revoking the implicit PUBLIC one, so
-- the unauthenticated `anon` role could still call
-- find_user_by_phone/find_user_by_email directly (they don't
-- check auth.uid() — they just look up by the input value) and
-- probe whether a given phone number or email has a BygSmart
-- account, with no login required.
--
-- This does NOT apply to get_effective_task_role/is_task_owner/
-- set_task_disabled_tabs from the same batch — those all key off
-- auth.uid() internally, so an anon caller (auth.uid() = NULL)
-- gets NULL/false/an authorization error either way, no
-- information disclosed. Only the two lookup RPCs are an actual
-- oracle.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.find_user_by_phone(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.find_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;
