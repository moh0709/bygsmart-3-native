-- ============================================================
-- MIGRATION: revoke REST execute on the Phase 2 org TRIGGER
-- functions. They run as triggers only — nobody should be able to
-- address them via PostgREST /rest/v1/rpc (they would error, but
-- the advisor flags the exposure and the hardening is free).
-- Same pattern as 20260710000006_lock_down_lookup_rpcs_to_authenticated.
-- ============================================================

REVOKE ALL ON FUNCTION public.protect_last_org_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.projects_default_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_org_member_from_team_seat() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_new_team_to_org() FROM PUBLIC, anon, authenticated;
