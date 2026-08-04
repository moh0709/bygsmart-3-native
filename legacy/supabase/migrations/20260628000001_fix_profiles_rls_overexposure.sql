-- ============================================================
-- F-02: Fix profiles RLS over-exposure
-- ============================================================
-- The old "profiles_select_project_member" policy had an UNCORRELATED branch
-- (p.owner_id = auth.uid()) inside its EXISTS subquery:
--
--   EXISTS (
--     SELECT 1 FROM public.projects p
--     WHERE p.owner_id = auth.uid()                                   -- <-- not tied to the target row
--        OR p.team @> jsonb_build_array(jsonb_build_object('id', id)) -- target side
--   )
--
-- Because the first branch never references the target profile row, ANY user who
-- owns at least one project matched the EXISTS for EVERY row in public.profiles,
-- leaking emails, stripe_customer_id and subscription_tier of unrelated users via
-- the public anon/authenticated key.
--
-- The fix correlates BOTH sides to the SAME project p: the caller must be a member
-- (owner or team) of a project AND the target profile must also be a member of that
-- same project.
--
-- Recursion safety: the helper is SECURITY DEFINER, queries only public.projects
-- (bypassing its RLS) and never reads public.profiles, so it cannot recurse back
-- into the profiles policies that invoke it.

CREATE OR REPLACE FUNCTION public.shares_project_with_caller(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE (
            p.owner_id = auth.uid()
            OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
          )
      AND (
            p.owner_id = p_profile_id
            OR p.team @> jsonb_build_array(jsonb_build_object('id', p_profile_id::TEXT))
          )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.shares_project_with_caller(UUID) TO authenticated;

-- Replace the flawed policy with the correlated version.
DROP POLICY IF EXISTS "profiles_select_project_member" ON public.profiles;

CREATE POLICY "profiles_select_project_member"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ( public.shares_project_with_caller(id) );
