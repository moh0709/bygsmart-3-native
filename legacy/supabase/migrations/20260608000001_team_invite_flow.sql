-- ============================================================
-- MIGRATION: Team Invite End-to-End Flow
-- Phase: creates teams/team_seats tables, profile columns,
--        enhanced trigger, RPCs, RLS fix, notification metadata
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix RLS bug: profiles_select_project_member used p.id
--    (the project UUID) instead of profiles.id (the user UUID)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_project_member" ON public.profiles;

CREATE POLICY "profiles_select_project_member"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.owner_id = auth.uid()
         OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.owner_id = auth.uid()
         OR p.team @> jsonb_build_array(jsonb_build_object('id', profiles.id::TEXT))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Create public.teams table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    leader_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader ON public.teams(leader_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Leader can fully manage their own team
CREATE POLICY "teams_leader_all" ON public.teams
    FOR ALL
    USING (leader_id = auth.uid())
    WITH CHECK (leader_id = auth.uid());

-- Team members (profiles with team_id) can read their team
CREATE POLICY "teams_member_select" ON public.teams
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.team_id = teams.id
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 3. Create public.team_seats table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_seats (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    email             TEXT        NOT NULL,
    subscription_tier TEXT        NOT NULL DEFAULT 'PRO'
                                  CHECK (subscription_tier IN ('PRO', 'PREMIUM')),
    status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'active', 'declined')),
    profile_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_seats_team    ON public.team_seats(team_id);
CREATE INDEX IF NOT EXISTS idx_team_seats_email   ON public.team_seats(email);
CREATE INDEX IF NOT EXISTS idx_team_seats_profile ON public.team_seats(profile_id);

ALTER TABLE public.team_seats ENABLE ROW LEVEL SECURITY;

-- Leader can manage all seats for their team
CREATE POLICY "team_seats_leader_all" ON public.team_seats
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_seats.team_id AND t.leader_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_seats.team_id AND t.leader_id = auth.uid()
        )
    );

-- Staff can read their own seat (by profile_id or matching email)
CREATE POLICY "team_seats_staff_select" ON public.team_seats
    FOR SELECT
    USING (
        profile_id = auth.uid()
        OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- Staff can update their own seat (to accept/decline)
CREATE POLICY "team_seats_staff_update" ON public.team_seats
    FOR UPDATE
    USING (
        profile_id = auth.uid()
        OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- ─────────────────────────────────────────────────────────────
-- 4. Add missing profile columns
--    (AuthProvider already queries these; NOW they exist in DB)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS team_id   UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS team_role TEXT,
    ADD COLUMN IF NOT EXISTS job_title TEXT,
    ADD COLUMN IF NOT EXISTS cvr       TEXT,
    ADD COLUMN IF NOT EXISTS address   TEXT,
    ADD COLUMN IF NOT EXISTS phone     TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Add type + metadata columns to notifications
--    (backward-compatible: defaults preserve existing rows)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS type     TEXT    NOT NULL DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS metadata JSONB   NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 6. Enhanced handle_new_user() trigger
--    After profile insert, auto-activate any matching pending seat
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    username_val    TEXT;
    seat_rec        public.team_seats%ROWTYPE;
    leader_profile  public.profiles%ROWTYPE;
    tier_val        subscription_tier;
BEGIN
    -- Derive username from metadata or email
    username_val := COALESCE(
        NEW.raw_user_meta_data->>'username',
        SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 1000)::TEXT
    );

    -- Insert basic profile
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

    -- Check if a pending team seat exists for this email
    SELECT ts.* INTO seat_rec
    FROM public.team_seats ts
    WHERE LOWER(ts.email) = LOWER(NEW.email)
      AND ts.status = 'pending'
    ORDER BY ts.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        -- Map seat tier text to enum
        BEGIN
            tier_val := seat_rec.subscription_tier::subscription_tier;
        EXCEPTION WHEN OTHERS THEN
            tier_val := 'FREE'::subscription_tier;
        END;

        -- Activate seat and link profile
        UPDATE public.team_seats
        SET status     = 'active',
            profile_id = NEW.id
        WHERE id = seat_rec.id;

        -- Update the profile with team assignment and tier
        UPDATE public.profiles
        SET team_id           = seat_rec.team_id,
            team_role         = 'member',
            subscription_tier = tier_val
        WHERE id = NEW.id;

        -- Load leader profile for connection and notification
        SELECT * INTO leader_profile
        FROM public.profiles
        WHERE id = (SELECT leader_id FROM public.teams WHERE id = seat_rec.team_id);

        IF FOUND THEN
            -- Create bidirectional connection: leader ↔ new member
            INSERT INTO public.user_connections (user_id, connected_user_id, role)
            VALUES (leader_profile.id, NEW.id, 'EMPLOYEE')
            ON CONFLICT (user_id, connected_user_id) DO NOTHING;

            INSERT INTO public.user_connections (user_id, connected_user_id, role)
            VALUES (NEW.id, leader_profile.id, 'EMPLOYEE')
            ON CONFLICT (user_id, connected_user_id) DO NOTHING;

            -- Notify leader
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (DROP + CREATE to replace)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_my_team_invites()
--    Returns pending seats for the current user's email
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_team_invites()
RETURNS TABLE (
    seat_id           UUID,
    team_id           UUID,
    team_name         TEXT,
    leader_name       TEXT,
    leader_initials   TEXT,
    subscription_tier TEXT,
    created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
    IF v_email IS NULL THEN RETURN; END IF;

    RETURN QUERY
        SELECT
            ts.id,
            ts.team_id,
            t.name,
            p.name,
            p.initials,
            ts.subscription_tier,
            ts.created_at
        FROM public.team_seats ts
        JOIN public.teams t ON t.id = ts.team_id
        JOIN public.profiles p ON p.id = t.leader_id
        WHERE LOWER(ts.email) = LOWER(v_email)
          AND ts.status = 'pending'
        ORDER BY ts.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_invites() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: accept_team_invite(p_seat_id UUID)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_seat_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        UUID := auth.uid();
    v_seat          public.team_seats%ROWTYPE;
    v_team          public.teams%ROWTYPE;
    v_caller_email  TEXT;
    v_caller_name   TEXT;
    v_tier          subscription_tier;
BEGIN
    SELECT email, name INTO v_caller_email, v_caller_name
    FROM public.profiles WHERE id = v_caller;

    -- Verify seat belongs to caller
    SELECT * INTO v_seat
    FROM public.team_seats
    WHERE id = p_seat_id
      AND status = 'pending'
      AND (profile_id = v_caller OR LOWER(email) = LOWER(v_caller_email));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
    END IF;

    -- Map tier
    BEGIN
        v_tier := v_seat.subscription_tier::subscription_tier;
    EXCEPTION WHEN OTHERS THEN
        v_tier := 'FREE'::subscription_tier;
    END;

    SELECT * INTO v_team FROM public.teams WHERE id = v_seat.team_id;

    -- Activate seat
    UPDATE public.team_seats
    SET status     = 'active',
        profile_id = v_caller
    WHERE id = p_seat_id;

    -- Update profile with team + tier
    UPDATE public.profiles
    SET team_id           = v_seat.team_id,
        team_role         = 'member',
        subscription_tier = v_tier
    WHERE id = v_caller;

    -- Bidirectional connection with team leader
    INSERT INTO public.user_connections (user_id, connected_user_id, role)
    VALUES (v_team.leader_id, v_caller, 'EMPLOYEE')
    ON CONFLICT (user_id, connected_user_id) DO NOTHING;

    INSERT INTO public.user_connections (user_id, connected_user_id, role)
    VALUES (v_caller, v_team.leader_id, 'EMPLOYEE')
    ON CONFLICT (user_id, connected_user_id) DO NOTHING;

    -- Notify leader
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_team.leader_id,
        v_caller_name || ' har accepteret din teaminvitation og er nu aktivt teammedlem',
        '#/team',
        'team_invite_accepted',
        jsonb_build_object('seat_id', p_seat_id, 'member_id', v_caller)
    );

    -- Notify the accepting user
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_caller,
        'Du er nu en del af teamet: ' || v_team.name,
        '#/team',
        'info',
        jsonb_build_object('team_id', v_seat.team_id)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. RPC: decline_team_invite(p_seat_id UUID)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decline_team_invite(p_seat_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        UUID := auth.uid();
    v_seat          public.team_seats%ROWTYPE;
    v_team          public.teams%ROWTYPE;
    v_caller_email  TEXT;
    v_caller_name   TEXT;
BEGIN
    SELECT email, name INTO v_caller_email, v_caller_name
    FROM public.profiles WHERE id = v_caller;

    SELECT * INTO v_seat
    FROM public.team_seats
    WHERE id = p_seat_id
      AND status = 'pending'
      AND (profile_id = v_caller OR LOWER(email) = LOWER(v_caller_email));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
    END IF;

    -- Mark seat as declined
    UPDATE public.team_seats SET status = 'declined' WHERE id = p_seat_id;

    SELECT * INTO v_team FROM public.teams WHERE id = v_seat.team_id;

    -- Notify leader
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_team.leader_id,
        COALESCE(v_caller_name, v_seat.email) || ' har afvist din teaminvitation',
        '#/team',
        'team_invite_declined',
        jsonb_build_object('seat_id', p_seat_id, 'email', v_seat.email)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_team_invite(UUID) TO authenticated;
