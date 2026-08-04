-- ============================================================
-- MIGRATION: org_module_entitlements + lean onboarding flip
-- (Phase 3 of the BYG 3.0 modular monolith).
--
-- 1. Per-org module overrides. Resolution precedence (server,
--    server/moduleCatalog.js):
--      global kill-switch → grandfathered → org row (valid_until
--      checked) → tier map → fail-open.
--    Rows are written ONLY by the service role (admin API now,
--    Stripe webhook in Phase 8 — stripe_subscription_item_id is
--    that seam). Org members may SELECT their own org's rows so
--    the client can display state and receive realtime flips.
--
-- 2. THE MARKETPLACE LAUNCH FLIP: orgs created from now on are no
--    longer grandfathered — create_organization() and the personal-
--    org block in handle_new_user() switch to grandfathered=FALSE,
--    so new organizations start lean (tier map) and grow by
--    enabling modules. Every org that exists BEFORE this migration
--    keeps grandfathered=TRUE (all modules, forever).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_module_entitlements (
    org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    module_id   text NOT NULL,
    status      text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled', 'trial')),
    source      text NOT NULL DEFAULT 'admin' CHECK (source IN ('tier', 'purchase', 'trial', 'admin')),
    valid_until timestamptz,
    -- Phase 8 seam: the Stripe subscription item that purchased this module.
    stripe_subscription_item_id text,
    note        text,
    updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (org_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_ome_org ON public.org_module_entitlements (org_id);

ALTER TABLE public.org_module_entitlements ENABLE ROW LEVEL SECURITY;

-- Members read their own org's rows (display + realtime); all writes go
-- through the service role (no INSERT/UPDATE/DELETE policies).
DROP POLICY IF EXISTS "ome_select_member" ON public.org_module_entitlements;
CREATE POLICY "ome_select_member" ON public.org_module_entitlements
    FOR SELECT TO authenticated
    USING (public.is_org_member(org_id));

DROP TRIGGER IF EXISTS org_module_entitlements_set_updated_at ON public.org_module_entitlements;
CREATE TRIGGER org_module_entitlements_set_updated_at
    BEFORE UPDATE ON public.org_module_entitlements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime: the client subscribes to its active org's rows and refreshes
-- entitlements live (PRD §10.6 Case A — activate without reload).
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_module_entitlements;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Lean onboarding: new orgs are NOT grandfathered from now on.
-- create_organization() — same body as 20260713000002 with
-- grandfathered=FALSE.
-- ─────────────────────────────────────────────────────────────

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
    VALUES (TRIM(p_name), NULLIF(TRIM(COALESCE(p_cvr, '')), ''), auth.uid(), FALSE)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
    VALUES (v_org_id, auth.uid(), 'owner', 'active', now());

    PERFORM set_config('app.privileged_profile_write', 'on', true);
    UPDATE public.profiles SET active_org_id = v_org_id WHERE id = auth.uid();

    RETURN v_org_id;
END;
$$;

-- handle_new_user(): flip ONLY the personal-org grandfathered flag from the
-- 20260713000001 body (TRUE → FALSE). Full body restated (house pattern —
-- CREATE OR REPLACE with the complete current definition).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    username_val    TEXT;
    seat_rec        public.team_seats%ROWTYPE;
    leader_profile  public.profiles%ROWTYPE;
    tier_text       TEXT;
    org_id_val      UUID;
BEGIN
    username_val := COALESCE(
        NEW.raw_user_meta_data->>'username',
        SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 1000)::TEXT
    );

    INSERT INTO public.profiles (id, username, name, initials, email, subscription_tier)
    VALUES (
        NEW.id,
        username_val,
        COALESCE(NEW.raw_user_meta_data->>'name', username_val),
        COALESCE(NEW.raw_user_meta_data->>'initials', UPPER(LEFT(username_val, 2))),
        NEW.email,
        'FREE'
    )
    ON CONFLICT (id) DO NOTHING;

    SELECT ts.* INTO seat_rec
    FROM public.team_seats ts
    WHERE LOWER(ts.email) = LOWER(NEW.email)
      AND ts.status = 'pending'
    ORDER BY ts.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        SELECT * INTO leader_profile
        FROM public.profiles
        WHERE id = (SELECT leader_id FROM public.teams WHERE id = seat_rec.team_id);

        tier_text := COALESCE(leader_profile.subscription_tier::TEXT, 'FREE');

        UPDATE public.team_seats
        SET status = 'active', profile_id = NEW.id
        WHERE id = seat_rec.id;

        UPDATE public.profiles
        SET team_id           = seat_rec.team_id,
            team_role         = 'member',
            subscription_tier = tier_text::subscription_tier
        WHERE id = NEW.id;

        IF leader_profile.id IS NOT NULL THEN
            INSERT INTO public.user_connections (user_id, connected_user_id, role)
            VALUES (leader_profile.id, NEW.id, 'EMPLOYEE')
            ON CONFLICT (user_id, connected_user_id) DO NOTHING;

            INSERT INTO public.user_connections (user_id, connected_user_id, role)
            VALUES (NEW.id, leader_profile.id, 'EMPLOYEE')
            ON CONFLICT (user_id, connected_user_id) DO NOTHING;

            INSERT INTO public.notifications (user_id, text, link, type, metadata)
            VALUES (
                leader_profile.id,
                username_val || ' har registreret sig og er nu et aktivt teammedlem',
                '#/team',
                'team_invite_accepted',
                jsonb_build_object('seat_id', seat_rec.id, 'member_id', NEW.id)
            );
        END IF;
    END IF;

    WITH linked AS (
        UPDATE public.quick_task_access
        SET user_id = NEW.id
        WHERE invite_email IS NOT NULL
          AND user_id IS NULL
          AND LOWER(invite_email) = LOWER(NEW.email)
        RETURNING task_id, invited_by
    )
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    SELECT
        linked.invited_by,
        username_val || ' har registreret sig og fået adgang til opgaven',
        '#/task/' || linked.task_id,
        'task_invite_accepted',
        jsonb_build_object('task_id', linked.task_id, 'member_id', NEW.id)
    FROM linked
    WHERE linked.invited_by IS NOT NULL;

    -- Organizations: reconcile org email invites and guarantee every user
    -- has at least one organization. Personal orgs created from the
    -- marketplace launch onward start LEAN (grandfathered = FALSE).
    BEGIN
        UPDATE public.organization_members
        SET user_id = NEW.id, status = 'active', accepted_at = now()
        WHERE invite_email IS NOT NULL
          AND user_id IS NULL
          AND LOWER(invite_email) = LOWER(NEW.email);

        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.user_id = NEW.id AND m.status = 'active'
        ) THEN
            INSERT INTO public.organizations (name, created_by, grandfathered)
            VALUES (
                COALESCE(NEW.raw_user_meta_data->>'name', username_val) || 's organisation',
                NEW.id,
                FALSE
            )
            RETURNING id INTO org_id_val;

            INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
            VALUES (org_id_val, NEW.id, 'owner', 'active', now());
        END IF;

        UPDATE public.profiles
        SET active_org_id = (
            SELECT m.org_id
            FROM public.organization_members m
            JOIN public.organizations o ON o.id = m.org_id
            WHERE m.user_id = NEW.id AND m.status = 'active'
            ORDER BY (o.source_team_id IS NOT NULL) DESC, m.created_at
            LIMIT 1
        )
        WHERE id = NEW.id AND active_org_id IS NULL;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- never block signup on org reconciliation
    END;

    RETURN NEW;
END;
$$;
