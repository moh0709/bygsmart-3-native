-- ============================================================
-- MIGRATION: Stripe-backed team member subscription tiers
-- Staff tier = leader's actual paid Stripe tier (not the seat label).
-- No Stripe payment → no paid tier, regardless of seat record.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Enhanced handle_new_user() trigger
--    Uses the leader's current subscription_tier (set by Stripe
--    webhook) instead of the seat's subscription_tier label.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    username_val    TEXT;
    seat_rec        public.team_seats%ROWTYPE;
    leader_profile  public.profiles%ROWTYPE;
    tier_val        subscription_tier;
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
        -- Load leader to get their ACTUAL Stripe-backed subscription tier.
        -- The leader's subscription_tier is only set by the Stripe webhook,
        -- so it reflects real payment status.
        SELECT * INTO leader_profile
        FROM public.profiles
        WHERE id = (SELECT leader_id FROM public.teams WHERE id = seat_rec.team_id);

        -- Use leader's paid tier; default FREE if leader has no active subscription.
        tier_val := COALESCE(leader_profile.subscription_tier, 'FREE'::subscription_tier);

        UPDATE public.team_seats
        SET status = 'active', profile_id = NEW.id
        WHERE id = seat_rec.id;

        UPDATE public.profiles
        SET team_id           = seat_rec.team_id,
            team_role         = 'member',
            subscription_tier = tier_val
        WHERE id = NEW.id;

        IF FOUND AND leader_profile.id IS NOT NULL THEN
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. Updated accept_team_invite RPC
--    Grants the leader's ACTUAL subscription_tier (Stripe-backed),
--    not the seat label. If the leader has no active paid subscription
--    the member receives FREE.
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
    v_leader        public.profiles%ROWTYPE;
    v_caller_email  TEXT;
    v_caller_name   TEXT;
    v_tier          subscription_tier;
BEGIN
    SELECT email, name INTO v_caller_email, v_caller_name
    FROM public.profiles WHERE id = v_caller;

    -- Verify seat belongs to caller and is still pending
    SELECT * INTO v_seat
    FROM public.team_seats
    WHERE id = p_seat_id
      AND status = 'pending'
      AND (profile_id = v_caller OR LOWER(email) = LOWER(v_caller_email));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_seat.team_id;

    -- Read leader's ACTUAL subscription tier — set exclusively by Stripe webhook.
    -- If the leader hasn't paid, their tier is FREE, so staff also gets FREE.
    SELECT * INTO v_leader FROM public.profiles WHERE id = v_team.leader_id;
    v_tier := COALESCE(v_leader.subscription_tier, 'FREE'::subscription_tier);

    UPDATE public.team_seats SET status = 'active', profile_id = v_caller WHERE id = p_seat_id;

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
        '#/team', 'team_invite_accepted',
        jsonb_build_object('seat_id', p_seat_id, 'member_id', v_caller)
    );

    -- Notify the accepting user (include the actual granted tier in metadata)
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_caller,
        'Du er nu en del af teamet: ' || v_team.name,
        '#/team', 'info',
        jsonb_build_object('team_id', v_seat.team_id, 'granted_tier', v_tier::TEXT)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invite(UUID) TO authenticated;
