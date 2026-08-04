-- Follow-up to 20260802000002_demo_membership_guard.sql.
--
-- Supabase's security advisor flagged is_demo_profile() as an
-- `anon_security_definer_function_executable`: because it is SECURITY DEFINER
-- and lives in `public`, PostgREST exposes it at /rest/v1/rpc/is_demo_profile,
-- so anyone could ask "is this UUID a demo account?" for any id they can guess
-- or observe. Small leak, but it is one this project introduced and does not
-- need: the helper exists purely so the block_demo_* triggers can ask the
-- question internally.
--
-- The trigger functions themselves (block_demo_*, reject_ledger_mutation) were
-- flagged by the same rule but are NOT reachable — they return `trigger`, and
-- PostgreSQL refuses to invoke a trigger function outside a trigger context.
-- Revoking anyway costs nothing and keeps the advisor output honest.
--
-- Safe because the guards are SECURITY DEFINER: they run as the function owner,
-- which keeps its own EXECUTE right. No application code calls any of these
-- (verified: zero references outside supabase/migrations).

REVOKE ALL ON FUNCTION public.is_demo_profile(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_demo_org_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_demo_project_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_demo_team_seat() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_ledger_mutation() FROM PUBLIC, anon, authenticated;
