-- Fix: handle_new_user() was missing SET search_path = public,
-- causing "type subscription_tier does not exist" because the enum
-- lives in the public schema and the trigger runs in auth schema context.

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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
