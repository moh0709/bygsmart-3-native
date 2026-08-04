-- Demo accounts are sandboxes: they may only ever belong to the organisation
-- and the projects they own themselves. Joining a real user's organisation,
-- project, partner list, task or team seat requires a real account.
--
-- Enforced with triggers rather than RLS because membership rows are written
-- from several places (client under RLS, the signup reconciliation inside
-- handle_new_user(), and service-role server routes) — a trigger is the one
-- chokepoint all of them pass through.

CREATE OR REPLACE FUNCTION public.is_demo_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = p_user_id), FALSE);
$$;

COMMENT ON FUNCTION public.is_demo_profile(UUID) IS
  'True when the profile is a demo account. Used by the demo membership guards.';

-- ─── Organisations ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_demo_org_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    org_owner UUID;
BEGIN
    IF NEW.user_id IS NULL OR NOT public.is_demo_profile(NEW.user_id) THEN
        RETURN NEW;
    END IF;

    SELECT created_by INTO org_owner FROM public.organizations WHERE id = NEW.org_id;

    -- A demo account keeps the personal organisation created for it at signup.
    IF org_owner IS NOT DISTINCT FROM NEW.user_id THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Demokonti kan ikke være medlem af en anden brugers organisation. Opret en rigtig konto for at deltage.'
        USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS block_demo_org_membership ON public.organization_members;
CREATE TRIGGER block_demo_org_membership
    BEFORE INSERT OR UPDATE OF user_id, org_id, status ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.block_demo_org_membership();

-- ─── Projects and tasks ──────────────────────────────────────────────────────
-- Shared by project_resources.user_id, project_partners.partner_id and
-- quick_task_access.user_id. TG_ARGV[0] names the member column, TG_ARGV[1]
-- names the reference column — 'project_id' directly, or 'task_id' which is
-- resolved to its project. Read via to_jsonb(NEW) so one function serves
-- tables with different shapes.
CREATE OR REPLACE FUNCTION public.block_demo_project_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_json JSONB := to_jsonb(NEW);
    member_id UUID;
    ref_id UUID;
    project_owner UUID;
BEGIN
    member_id := NULLIF(row_json ->> TG_ARGV[0], '')::UUID;

    IF member_id IS NULL OR NOT public.is_demo_profile(member_id) THEN
        RETURN NEW;
    END IF;

    ref_id := NULLIF(row_json ->> TG_ARGV[1], '')::UUID;

    IF TG_ARGV[1] = 'task_id' THEN
        SELECT p.owner_id INTO project_owner
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = ref_id;
    ELSE
        SELECT owner_id INTO project_owner FROM public.projects WHERE id = ref_id;
    END IF;

    -- Its own sandbox project (including the seeded demo project) is fine.
    IF project_owner IS NOT DISTINCT FROM member_id THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Demokonti kan ikke deltage i en anden brugers projekt. Opret en rigtig konto for at deltage.'
        USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS block_demo_project_resource ON public.project_resources;
CREATE TRIGGER block_demo_project_resource
    BEFORE INSERT OR UPDATE OF user_id, project_id ON public.project_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.block_demo_project_membership('user_id', 'project_id');

DROP TRIGGER IF EXISTS block_demo_project_partner ON public.project_partners;
CREATE TRIGGER block_demo_project_partner
    BEFORE INSERT OR UPDATE OF partner_id, project_id ON public.project_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.block_demo_project_membership('partner_id', 'project_id');

DROP TRIGGER IF EXISTS block_demo_quick_task_access ON public.quick_task_access;
CREATE TRIGGER block_demo_quick_task_access
    BEFORE INSERT OR UPDATE OF user_id, task_id ON public.quick_task_access
    FOR EACH ROW
    EXECUTE FUNCTION public.block_demo_project_membership('user_id', 'task_id');

-- ─── Team seats ──────────────────────────────────────────────────────────────
-- Seats are billed through Stripe; a demo account must never occupy one.
CREATE OR REPLACE FUNCTION public.block_demo_team_seat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.profile_id IS NOT NULL AND public.is_demo_profile(NEW.profile_id) THEN
        RAISE EXCEPTION 'Demokonti kan ikke optage en teamplads. Opret en rigtig konto for at deltage.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_demo_team_seat ON public.team_seats;
CREATE TRIGGER block_demo_team_seat
    BEFORE INSERT OR UPDATE OF profile_id ON public.team_seats
    FOR EACH ROW
    EXECUTE FUNCTION public.block_demo_team_seat();
