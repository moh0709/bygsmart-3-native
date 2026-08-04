-- Fix: deleting a user was impossible once they owned an organisation.
--
-- 20260713000002_org_rls_helpers.sql added protect_last_org_owner() to stop an
-- organisation losing its final active owner. It fires BEFORE UPDATE OR DELETE
-- on organization_members and raises whenever the departing row is the last
-- active owner — including when that row is only disappearing because the user
-- or the organisation is itself being deleted.
--
-- Every account gets a personal organisation at signup and is its sole owner,
-- so account deletion hit this every time. Both cascade paths lead here:
--
--   DELETE auth.users / profiles
--     ├─ organization_members.user_id  (CASCADE) ──┐
--     └─ organizations.created_by      (CASCADE)   ├─→ protect_last_org_owner → P0001
--          └─ organization_members.org_id (CASCADE)┘
--
-- Surfaced as "Database error deleting user" from the Supabase Auth admin API,
-- which is what DELETE /api/admin/users/:id reported as a 500. Measured on
-- production 2026-08-03: all 13 demo organisations had exactly one member who
-- was the sole active owner, so it failed deterministically.
--
-- The guard's real job is to stop someone DEMOTING or REMOVING the last owner
-- while the organisation and the user both still exist. It has nothing to
-- protect once either side is already gone. So: keep the rule for live rows,
-- and let the row go when its organisation or its member no longer exists.
--
-- Verified against production in rolled-back transactions: deleting all 13 demo
-- accounts succeeds, and demoting a sole owner of a live organisation is still
-- rejected.

CREATE OR REPLACE FUNCTION public.protect_last_org_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Cascade, not a demotion: the organisation or the member is already gone.
    IF TG_OP = 'DELETE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.org_id)
           OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id) THEN
            RETURN OLD;
        END IF;
    END IF;

    IF OLD.role = 'owner' AND OLD.status = 'active'
       AND (TG_OP = 'DELETE'
            OR NEW.role <> 'owner'
            OR NEW.status <> 'active')
       AND NOT EXISTS (
           SELECT 1 FROM public.organization_members
           WHERE org_id = OLD.org_id
             AND role = 'owner'
             AND status = 'active'
             AND id <> OLD.id
       ) THEN
        RAISE EXCEPTION 'En organisation skal have mindst én aktiv ejer.';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.protect_last_org_owner() IS
  'Stops an organisation losing its last active owner by demotion or removal. '
  'Does not fire when the member row is disappearing because the organisation '
  'or the user is itself being deleted (account deletion / GDPR erasure).';
