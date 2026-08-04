-- ============================================================
-- MIGRATION: quick_task_access — add role + email-invite-without-
-- an-account support.
--
-- Part of the Unified Task Workspace merge (Owner/Responsible/
-- Worker/Viewer roles for both project and quick tasks).
--
-- 1. Add `role` column. Every row that exists BEFORE this
--    migration runs is bumped to 'responsible' so no current
--    quick-task collaborator loses the full-edit access they
--    have today; only genuinely new invites (created by the
--    application after this ships) default to 'worker'.
-- 2. Make `user_id` nullable + add `invite_email`, so a task can
--    be shared with someone who doesn't have a BygSmart account
--    yet. `handle_new_user()` is extended to auto-link such rows
--    once the invitee signs up with the matching email — mirrors
--    the existing team_seats pending-invite reconciliation already
--    in this function (see 20260609000002_fix_handle_new_user_search_path.sql).
-- ============================================================

ALTER TABLE public.quick_task_access
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS invite_email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'worker'
    CHECK (role IN ('owner', 'responsible', 'worker', 'viewer'));

ALTER TABLE public.quick_task_access
  DROP CONSTRAINT IF EXISTS qta_user_or_email;
ALTER TABLE public.quick_task_access
  ADD CONSTRAINT qta_user_or_email CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL);

-- Preserve today's de-facto full-edit access for everyone already
-- invited to a quick task. At this point in the migration every
-- row in the table predates the new role model.
UPDATE public.quick_task_access SET role = 'responsible';

-- Prevent duplicate email invites to the same task (mirrors the
-- existing UNIQUE (task_id, user_id) for account-holder invites).
-- Plain column index (not an expression on lower()) so PostgREST's
-- upsert onConflict='task_id,invite_email' can target it — the
-- application layer (services/taskAccess.ts) always normalizes
-- invite_email to lowercase before writing, so this is equivalent
-- to a case-insensitive constraint in practice.
CREATE UNIQUE INDEX IF NOT EXISTS qta_task_email_unique
  ON public.quick_task_access (task_id, invite_email)
  WHERE invite_email IS NOT NULL AND user_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- Reconcile invite_email rows with a newly-created profile.
-- Full function body copied from 20260609000002 (the last
-- CREATE OR REPLACE) with one new block added before RETURN NEW.
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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
