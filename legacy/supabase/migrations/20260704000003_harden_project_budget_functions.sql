-- Pin search_path on the two new trigger functions (matches the standard already
-- used on the 5 new RPCs, which all set search_path=public) and revoke the
-- default PUBLIC-wide EXECUTE grant on the 5 new RPCs so only `authenticated`
-- can call them (anon still gets rejected internally via auth.uid() checks
-- today, but there's no reason to leave the endpoint reachable at all).
-- Flagged by get_advisors after 20260704000002; the same two lint categories
-- are pre-existing across ~50 other functions in this schema (is_project_owner,
-- get_project_guarded, etc.) — out of scope to fix wholesale here.

ALTER FUNCTION public.protect_project_budget_baseline() SET search_path = public;
ALTER FUNCTION public.reject_ledger_mutation() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_project_budget_summary(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_project_budget_baseline(UUID, JSONB, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_project_budget_revision(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_project_labor_rate(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_task_hourly_rate(UUID, NUMERIC) FROM PUBLIC;
