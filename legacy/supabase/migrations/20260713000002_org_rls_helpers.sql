-- ============================================================
-- MIGRATION: org RLS helpers, policies, RPCs and sync triggers
-- (Phase 2 of the BYG 3.0 modular monolith).
--
-- Follows the house template (get_effective_task_role, 20260710000002):
-- SECURITY DEFINER STABLE helpers so policies stay flat and
-- non-recursive; privileged writes via SECURITY DEFINER RPCs locked
-- down to authenticated (REVOKE pattern from 20260710000006).
--
-- Org RLS posture is ADDITIVE/GRANT-ONLY (plan decision D3): org
-- membership never becomes a denial condition on existing
-- project-scoped policies — the only change to an existing table is
-- one new SELECT grant on projects for org owners/admins.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = p_org_id
          AND user_id = auth.uid()
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT role FROM public.organization_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_active_org_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT active_org_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
CREATE POLICY "organizations_select_member" ON public.organizations
    FOR SELECT TO authenticated
    USING (public.is_org_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "organizations_update_owner_admin" ON public.organizations;
CREATE POLICY "organizations_update_owner_admin" ON public.organizations
    FOR UPDATE TO authenticated
    USING (public.get_org_role(id) IN ('owner', 'admin'))
    WITH CHECK (public.get_org_role(id) IN ('owner', 'admin'));
-- No INSERT policy: orgs are created via create_organization() (SECURITY
-- DEFINER). No DELETE policy in Phase 2 — org deletion is a later flow.

DROP POLICY IF EXISTS "organization_members_select_member" ON public.organization_members;
CREATE POLICY "organization_members_select_member" ON public.organization_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_org_member(org_id));

DROP POLICY IF EXISTS "organization_members_insert_admin" ON public.organization_members;
CREATE POLICY "organization_members_insert_admin" ON public.organization_members
    FOR INSERT TO authenticated
    WITH CHECK (public.get_org_role(org_id) IN ('owner', 'admin'));

-- UPDATE is admin-only; the invitee's own pending→active transition goes
-- through accept_org_invite() below (a self-UPDATE policy would let a
-- member rewrite their own role — RLS cannot do column-level guards).
DROP POLICY IF EXISTS "organization_members_update_admin" ON public.organization_members;
CREATE POLICY "organization_members_update_admin" ON public.organization_members
    FOR UPDATE TO authenticated
    USING (public.get_org_role(org_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_org_role(org_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "organization_members_delete_admin_or_self" ON public.organization_members;
CREATE POLICY "organization_members_delete_admin_or_self" ON public.organization_members
    FOR DELETE TO authenticated
    USING (public.get_org_role(org_id) IN ('owner', 'admin') OR user_id = auth.uid());

-- Additive grant on projects: org owners/admins can LIST their org's
-- projects (management overview). Existing project policies are untouched.
DROP POLICY IF EXISTS "projects_select_org_admin" ON public.projects;
CREATE POLICY "projects_select_org_admin" ON public.projects
    FOR SELECT TO authenticated
    USING (org_id IS NOT NULL AND public.get_org_role(org_id) IN ('owner', 'admin'));

-- ─────────────────────────────────────────────────────────────
-- Integrity guard: an org must never lose its last active owner.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_last_org_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS organization_members_protect_last_owner ON public.organization_members;
CREATE TRIGGER organization_members_protect_last_owner
    BEFORE UPDATE OR DELETE ON public.organization_members
    FOR EACH ROW EXECUTE FUNCTION public.protect_last_org_owner();

-- ─────────────────────────────────────────────────────────────
-- RPCs (privileged writes)
-- ─────────────────────────────────────────────────────────────

-- Create an org + owner membership + switch to it, atomically.
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT, p_cvr TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Login er påkrævet.';
    END IF;
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 2 THEN
        RAISE EXCEPTION 'Organisationsnavn skal være mindst 2 tegn.';
    END IF;

    INSERT INTO public.organizations (name, cvr, created_by, grandfathered)
    VALUES (TRIM(p_name), NULLIF(TRIM(COALESCE(p_cvr, '')), ''), auth.uid(), TRUE)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
    VALUES (v_org_id, auth.uid(), 'owner', 'active', now());

    PERFORM set_config('app.privileged_profile_write', 'on', true);
    UPDATE public.profiles SET active_org_id = v_org_id WHERE id = auth.uid();

    RETURN v_org_id;
END;
$$;

-- Switch the caller's active org — validates active membership, so a
-- forged org id can never be activated.
CREATE OR REPLACE FUNCTION public.set_active_org(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Du er ikke aktivt medlem af denne organisation.';
    END IF;

    PERFORM set_config('app.privileged_profile_write', 'on', true);
    UPDATE public.profiles SET active_org_id = p_org_id WHERE id = auth.uid();
END;
$$;

-- Invitee accepts their own pending membership.
CREATE OR REPLACE FUNCTION public.accept_org_invite(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.organization_members
    SET status = 'active', accepted_at = now()
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingen afventende invitation fundet.';
    END IF;
END;
$$;

-- Lock the RPCs down to signed-in users (hardening pattern from
-- 20260710000006 — SECURITY DEFINER functions default to PUBLIC execute).
REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_org_role(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_organization(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_active_org(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_org_invite(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- projects.org_id default — BEFORE INSERT trigger so no client
-- call-site needs changing. Attaches the creator's active org
-- (membership-validated); rejects a client-supplied org the
-- inserter isn't an active member of. Service-role inserts
-- (auth.uid() IS NULL) fall back to the row's owner.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.projects_default_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := COALESCE(auth.uid(), NEW.owner_id);
    v_org  UUID;
BEGIN
    IF NEW.org_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
        -- Client-supplied org must be one the inserter actually belongs to.
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.org_id = NEW.org_id AND m.user_id = auth.uid() AND m.status = 'active'
        ) THEN
            NEW.org_id := NULL;
        END IF;
    END IF;

    IF NEW.org_id IS NULL AND v_user IS NOT NULL THEN
        SELECT p.active_org_id INTO v_org FROM public.profiles p WHERE p.id = v_user;
        IF v_org IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.org_id = v_org AND m.user_id = v_user AND m.status = 'active'
        ) THEN
            NEW.org_id := v_org;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_default_org ON public.projects;
CREATE TRIGGER projects_default_org
    BEFORE INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.projects_default_org();

-- ─────────────────────────────────────────────────────────────
-- team_seats → organization_members mirror. Teams/seats remain the
-- Stripe billing source of truth until Phase 8; the org membership
-- table follows them automatically, so there is exactly ONE write
-- path and zero billing drift. Guarded: a mirror bug must never
-- break the seat/billing flows.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_org_member_from_team_seat()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org       UUID;
    v_leader_id UUID;
BEGIN
    BEGIN
        SELECT o.id INTO v_org
        FROM public.organizations o
        WHERE o.source_team_id = COALESCE(NEW.team_id, OLD.team_id);
        IF v_org IS NULL THEN
            RETURN COALESCE(NEW, OLD);
        END IF;

        SELECT t.leader_id INTO v_leader_id
        FROM public.teams t WHERE t.id = COALESCE(NEW.team_id, OLD.team_id);

        IF TG_OP = 'DELETE' THEN
            UPDATE public.organization_members
            SET status = 'removed'
            WHERE org_id = v_org
              AND role = 'member'
              AND ((OLD.profile_id IS NOT NULL AND user_id = OLD.profile_id)
                   OR (OLD.profile_id IS NULL AND user_id IS NULL
                       AND invite_email IS NOT NULL
                       AND LOWER(invite_email) = LOWER(COALESCE(OLD.email, ''))));
            RETURN OLD;
        END IF;

        IF NEW.status = 'active' AND NEW.profile_id IS NOT NULL THEN
            INSERT INTO public.organization_members (org_id, user_id, role, status, invited_by, accepted_at)
            VALUES (v_org, NEW.profile_id, 'member', 'active', v_leader_id, now())
            ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL
            DO UPDATE SET status = 'active',
                          accepted_at = COALESCE(public.organization_members.accepted_at, now());
        ELSIF NEW.status = 'pending' AND NEW.profile_id IS NOT NULL THEN
            INSERT INTO public.organization_members (org_id, user_id, role, status, invited_by)
            VALUES (v_org, NEW.profile_id, 'member', 'pending', v_leader_id)
            ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL
            DO NOTHING;
        ELSIF NEW.status = 'pending' AND NEW.email IS NOT NULL THEN
            INSERT INTO public.organization_members (org_id, invite_email, role, status, invited_by)
            VALUES (v_org, LOWER(NEW.email), 'member', 'pending', v_leader_id)
            ON CONFLICT (org_id, invite_email) WHERE invite_email IS NOT NULL AND user_id IS NULL
            DO NOTHING;
        ELSIF NEW.status NOT IN ('active', 'pending') THEN
            -- Seat cancelled/removed → membership follows (never touch owners).
            UPDATE public.organization_members
            SET status = 'removed'
            WHERE org_id = v_org
              AND role = 'member'
              AND ((NEW.profile_id IS NOT NULL AND user_id = NEW.profile_id)
                   OR (NEW.profile_id IS NULL AND user_id IS NULL
                       AND invite_email IS NOT NULL
                       AND LOWER(invite_email) = LOWER(COALESCE(NEW.email, ''))));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- best-effort mirror — never break the seat/billing flow
    END;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS team_seats_sync_org_member ON public.team_seats;
CREATE TRIGGER team_seats_sync_org_member
    AFTER INSERT OR UPDATE OR DELETE ON public.team_seats
    FOR EACH ROW EXECUTE FUNCTION public.sync_org_member_from_team_seat();

-- New teams created after this migration claim the leader's active org
-- (keeps the team↔org 1:1 mapping alive for future PRO upgrades).
CREATE OR REPLACE FUNCTION public.link_new_team_to_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        UPDATE public.organizations o
        SET source_team_id = NEW.id
        WHERE o.id = (SELECT active_org_id FROM public.profiles WHERE id = NEW.leader_id)
          AND o.source_team_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.organizations o2 WHERE o2.source_team_id = NEW.id);
    EXCEPTION WHEN OTHERS THEN
        NULL; -- best-effort — never break team creation
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_link_org ON public.teams;
CREATE TRIGGER teams_link_org
    AFTER INSERT ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.link_new_team_to_org();
