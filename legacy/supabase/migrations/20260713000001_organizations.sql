-- ============================================================
-- MIGRATION: organizations + organization_members (Phase 2 of
-- the BYG 3.0 modular monolith — multi-org tenancy).
--
-- Additive only. Creates the org tables, adds profiles.active_org_id
-- and projects.org_id (both nullable), and extends handle_new_user()
-- and the profiles column guard. RLS policies + helper functions land
-- in 20260713000002; the production backfill in 20260713000003.
--
-- Model (locked decisions):
--   • organizations absorbs the companies fields (name/cvr/address/logo).
--   • teams + team_seats remain the Stripe billing vehicle until Phase 8;
--     organization_members MIRRORS team_seats via trigger (teams stay the
--     source of truth — no billing drift).
--   • organization_members mirrors the quick_task_access email-invite
--     pattern: nullable user_id + invite_email + partial unique indexes,
--     reconciled by handle_new_user() on signup.
--   • grandfathered = TRUE ⇒ the org keeps every module forever (the
--     tier→module map only ever applies to non-grandfathered orgs).
--     All orgs created before the module marketplace launches are
--     grandfathered.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 text NOT NULL,
    cvr                  text,
    address              text,
    logo_url             text,
    created_by           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grandfathered        boolean NOT NULL DEFAULT TRUE,
    storage_allowance_gb integer NOT NULL DEFAULT 5,
    -- Backfill idempotency keys: which legacy group this org was derived from.
    source_team_id       uuid UNIQUE,
    source_company_id    uuid UNIQUE,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    invite_email text,
    role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
    invited_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz,

    CONSTRAINT om_user_or_email CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL)
);

-- One membership per user per org; one open email invite per address per org.
-- invite_email is normalized to lowercase in the application layer (same
-- contract as quick_task_access — see 20260710000001).
CREATE UNIQUE INDEX IF NOT EXISTS om_org_user_unique
    ON public.organization_members (org_id, user_id)
    WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS om_org_email_unique
    ON public.organization_members (org_id, invite_email)
    WHERE invite_email IS NOT NULL AND user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_om_user ON public.organization_members (user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_om_org ON public.organization_members (org_id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects (org_id) WHERE org_id IS NOT NULL;

-- RLS on (policies land in 20260713000002 — until then only the service
-- role can touch the tables, which is safe because nothing reads them yet).
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- updated_at maintenance (reuses public.set_updated_at()).
DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Column guard: active_org_id may only move through the
-- set_active_org() RPC (20260713000002), which validates active
-- membership and opts in via the transaction-local GUC — the same
-- mechanism accept_team_invite() uses for team_id/team_role.
-- Full function body from 20260703000007 with ONE line added.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_trial_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        -- Admin-granted trial overlay — service-role admin API only.
        NEW.trial_tier := OLD.trial_tier;
        NEW.trial_ends_at := OLD.trial_ends_at;
        NEW.trial_granted_by := OLD.trial_granted_by;
        NEW.trial_granted_at := OLD.trial_granted_at;

        -- Platform admin flag — the authorization gate for the whole admin
        -- surface. Only the service-role admin API (auth.uid() IS NULL) may
        -- ever change it. Never settable by an end user.
        NEW.app_role := OLD.app_role;

        -- Demo status is set exclusively by the demo/claim service-role flows.
        NEW.is_demo := OLD.is_demo;

        -- Stripe identity is written only by the checkout/webhook service role.
        NEW.stripe_customer_id := OLD.stripe_customer_id;
        NEW.stripe_subscription_id := OLD.stripe_subscription_id;

        -- Team membership is written only by accept_team_invite()/handle_new_user().
        -- accept_team_invite() opts in via the flag below; everything else (a
        -- direct client UPDATE) is frozen.
        IF current_setting('app.privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
            NEW.team_id := OLD.team_id;
            NEW.team_role := OLD.team_role;
            -- Active org moves only through set_active_org(), which validates
            -- membership — a forged active_org_id can never widen access.
            NEW.active_org_id := OLD.active_org_id;
        END IF;

        -- company_id is derived by link_profile_company() strictly from cvr /
        -- company_name. Allow it to change only when one of those source columns
        -- is also changing in this same UPDATE; otherwise a direct company_id
        -- self-assign (to read a victim company row) is frozen.
        IF NEW.company_id IS DISTINCT FROM OLD.company_id
           AND NEW.cvr IS NOT DISTINCT FROM OLD.cvr
           AND NEW.company_name IS NOT DISTINCT FROM OLD.company_name THEN
            NEW.company_id := OLD.company_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- handle_new_user() — full body from 20260710000001 with ONE new
-- guarded block added before RETURN NEW:
--   1. link pending organization_members email invites to the new
--      account (auto-activate: clicking the invite + signing up IS
--      the acceptance),
--   2. if the user still has no active membership, create their
--      personal organization (grandfathered until the marketplace
--      launches in Phase 3),
--   3. point active_org_id at their best org (team-backed first).
-- The block traps ALL errors — an org bug can never block signup.
-- ─────────────────────────────────────────────────────────────

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

    -- Check for a pending team seat matching this email
    SELECT ts.* INTO seat_rec
    FROM public.team_seats ts
    WHERE LOWER(ts.email) = LOWER(NEW.email)
      AND ts.status = 'pending'
    ORDER BY ts.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- Load leader to get their ACTUAL Stripe-backed subscription tier
        SELECT * INTO leader_profile
        FROM public.profiles
        WHERE id = (SELECT leader_id FROM public.teams WHERE id = seat_rec.team_id);

        -- Use leader's real paid tier as text; default FREE
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

    -- Reconcile any pending quick_task_access email invites addressed
    -- to this email — link them to the just-created account so the
    -- task shows up for the invitee once they log in and accept.
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

    -- Organizations (BYG 3.0 Phase 2): reconcile org email invites and
    -- guarantee every user has at least one organization. Fully guarded —
    -- an org failure must never block signup.
    BEGIN
        -- 1. Link pending org email invites (invite + signup = acceptance).
        UPDATE public.organization_members
        SET user_id = NEW.id, status = 'active', accepted_at = now()
        WHERE invite_email IS NOT NULL
          AND user_id IS NULL
          AND LOWER(invite_email) = LOWER(NEW.email);

        -- 2. Personal org when nothing else claimed the user. (The team-seat
        --    block above already ran; its seat UPDATE fired the org-mirror
        --    trigger, so team members have their membership by now.)
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.user_id = NEW.id AND m.status = 'active'
        ) THEN
            INSERT INTO public.organizations (name, created_by, grandfathered)
            VALUES (
                COALESCE(NEW.raw_user_meta_data->>'name', username_val) || 's organisation',
                NEW.id,
                TRUE
            )
            RETURNING id INTO org_id_val;

            INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
            VALUES (org_id_val, NEW.id, 'owner', 'active', now());
        END IF;

        -- 3. Point the session at their best org (team-backed first).
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
