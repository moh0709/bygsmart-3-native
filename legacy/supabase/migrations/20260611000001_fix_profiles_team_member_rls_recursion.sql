-- Fix profiles SELECT recursion:
-- The old profiles_select_team_member policy selected from public.profiles
-- while Postgres was already evaluating policies on public.profiles.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_team_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.team_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.current_user_team_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_team_id() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_team_member" ON public.profiles;

CREATE POLICY "profiles_select_team_member"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL
    AND team_id = private.current_user_team_id()
  );
