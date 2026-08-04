-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: privileged-column guards on profiles + project_resources,
-- and a cross-tenant view leak fix.
--
-- The browser talks to PostgREST with the anon key, so RLS + these BEFORE-UPDATE
-- guards are the authorization boundary. The pre-existing `profiles_update_own`
-- policy allows a user to UPDATE their own row, and the WITH CHECK only pinned
-- `subscription_tier`; the `protect_trial_columns` trigger only reset the four
-- trial_* columns. Every OTHER privileged column on profiles was therefore
-- writable from a browser console, most seriously:
--
--   CRITICAL  app_role  — `update profiles set app_role='admin' where id=<me>`
--                         grants the caller the entire platform-admin surface
--                         (admin API + all admin-only RLS tables: AI keys, SMTP
--                         creds, tool access, terminations, every user's PII).
--   HIGH      team_id / team_role — self-assigning a victim's team_id turns the
--                         attacker into a "team member" and exposes every team
--                         member's profile PII via profiles_select_team_member.
--   MEDIUM    stripe_customer_id / stripe_subscription_id — setting these to a
--                         paying customer's id piggybacks their tier on the next
--                         webhook subscription event.
--   LOW       is_demo, company_id — demo-gating bypass; read one victim company.
--
-- Fix: extend the guard trigger to freeze all of these for authenticated
-- end-user writes, while preserving the two trusted flows that legitimately
-- change them:
--   • accept_team_invite() — a SECURITY DEFINER RPC with no column-injection
--     surface — opts in via a transaction-local flag (app.privileged_profile_write).
--   • link_profile_company() — a BEFORE trigger that sets company_id ONLY when
--     cvr/company_name change; we allow company_id to move in exactly that case.
--   • handle_new_user() and the admin API / Stripe webhook run with
--     auth.uid() IS NULL and pass through untouched.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- accept_team_invite() legitimately sets team_id/team_role on the caller's own
-- profile. It fully controls its own UPDATE (no user-supplied columns), so it is
-- safe to opt that single statement out of the team-column freeze via a
-- transaction-local GUC. set_config(..., is_local => true) is scoped to the
-- current transaction and auto-clears at commit/rollback.
--
-- NOTE: This body is the LIVE production definition (Stripe-backed leader tier —
-- v_leader.subscription_tier, per 20260609000001) with ONLY the two set_config
-- lines added around the profile UPDATE. Do not revert to a seat-based tier.
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_seat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

    -- Authorize this function's own team-column write to the caller's profile.
    PERFORM set_config('app.privileged_profile_write', 'on', true);

    UPDATE public.profiles
    SET team_id           = v_seat.team_id,
        team_role         = 'member',
        subscription_tier = v_tier
    WHERE id = v_caller;

    -- Close the window immediately after the intended write.
    PERFORM set_config('app.privileged_profile_write', 'off', true);

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

-- ─────────────────────────────────────────────────────────────────────────────
-- H-1: projects_summary view leaked every project cross-tenant. Views default to
-- security_invoker = false, so it ran as its owner and bypassed RLS on projects /
-- tasks (the identical bug already fixed for admin_handover_reports_v in
-- 20260703000004). Run it as the invoker so the caller's RLS applies.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.projects_summary SET (security_invoker = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- M-1: project_resources_update_self (USING/​WITH CHECK user_id = auth.uid(), no
-- column restriction) let an invited member self-escalate visibility. Setting
-- visibility='all' satisfies can_view_project_budget() and the "all" branches of
-- tasks/time_entries/reminders — a restricted member could read the project
-- budget, all tasks, and colleagues' time entries. The self-update is only meant
-- for accept/decline (a status transition). Freeze visibility (and kind) on a
-- member's self-update; the owner/manager update path (different policy, where
-- auth.uid() <> OLD.user_id) is unaffected and may still set visibility.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_project_resource_self_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
        NEW.visibility := OLD.visibility;
        NEW.kind := OLD.kind;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_resources_protect_self_update ON public.project_resources;
CREATE TRIGGER project_resources_protect_self_update
    BEFORE UPDATE ON public.project_resources
    FOR EACH ROW EXECUTE FUNCTION public.protect_project_resource_self_update();
