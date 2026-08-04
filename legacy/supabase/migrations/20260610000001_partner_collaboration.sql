-- ============================================================
-- MIGRATION: Partner (Underleverandør) Collaboration Flow
-- Phase 3: project_partners + partner_task_access +
--          partner_negotiation_messages with RLS as the
--          enforcement layer (not the client), a scoped
--          partner project view RPC, invite/accept/decline
--          RPCs and realtime on the negotiation thread.
--
-- Scoping guarantees:
--   * Partners get NO select on public.projects — only the
--     get_partner_project_view() RPC (name, description,
--     deadline). Budget, internal notes and member lists are
--     never exposed.
--   * Partners can only SELECT tasks rows explicitly listed in
--     partner_task_access for their own invitation.
--   * Negotiation messages are visible to the two parties of
--     the invitation only.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_partners (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    partner_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invited_by       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status           TEXT        NOT NULL DEFAULT 'invited'
                                 CHECK (status IN ('invited', 'negotiating', 'accepted', 'declined', 'cancelled')),
    agreed_price_ore BIGINT,     -- settled price in øre (1 DKK = 100 øre)
    currency         TEXT        NOT NULL DEFAULT 'DKK',
    message          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at       TIMESTAMPTZ,
    UNIQUE (project_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_project_partners_project ON public.project_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_partner ON public.project_partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_invited_by ON public.project_partners(invited_by);

CREATE OR REPLACE TRIGGER project_partners_updated_at
  BEFORE UPDATE ON public.project_partners
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_task_access (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_invite_id UUID NOT NULL REFERENCES public.project_partners(id) ON DELETE CASCADE,
    task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    UNIQUE (partner_invite_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_task_access_invite ON public.partner_task_access(partner_invite_id);
CREATE INDEX IF NOT EXISTS idx_partner_task_access_task   ON public.partner_task_access(task_id);

CREATE TABLE IF NOT EXISTS public.partner_negotiation_messages (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_invite_id UUID        NOT NULL REFERENCES public.project_partners(id) ON DELETE CASCADE,
    sender_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    kind              TEXT        NOT NULL DEFAULT 'message'
                                  CHECK (kind IN ('message', 'offer', 'counter_offer', 'accept', 'decline')),
    body              TEXT,
    amount_ore        BIGINT,     -- offer amount in øre, null for plain messages
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_messages_invite
  ON public.partner_negotiation_messages(partner_invite_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 2. RLS helper functions (SECURITY DEFINER, like
--    is_project_member / is_project_owner in the initial schema)
-- ─────────────────────────────────────────────────────────────

-- Manager of an invitation = project owner or the inviter.
CREATE OR REPLACE FUNCTION public.is_partner_invite_manager(p_invite_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.project_partners pp
        JOIN public.projects p ON p.id = pp.project_id
        WHERE pp.id = p_invite_id
          AND (p.owner_id = auth.uid() OR pp.invited_by = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Party of an invitation = manager or the invited partner.
CREATE OR REPLACE FUNCTION public.is_partner_invite_party(p_invite_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_partner_invite_manager(p_invite_id)
        OR EXISTS (
            SELECT 1 FROM public.project_partners pp
            WHERE pp.id = p_invite_id AND pp.partner_id = auth.uid()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Does the caller have partner access to this task via an
-- active (not declined/cancelled) invitation?
CREATE OR REPLACE FUNCTION public.has_partner_task_access(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.partner_task_access pta
        JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
        WHERE pta.task_id = p_task_id
          AND pp.partner_id = auth.uid()
          AND pp.status IN ('invited', 'negotiating', 'accepted')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ─────────────────────────────────────────────────────────────
-- 3. Column/transition guard: partners may ONLY change status,
--    and only along allowed transitions. The accept RPC below
--    bypasses the guard via a transaction-local flag.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_partner_invite_update()
RETURNS TRIGGER AS $$
BEGIN
    -- SECURITY DEFINER RPCs in this migration set this flag.
    IF COALESCE(current_setting('app.partner_invite_rpc', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    -- Service role / server-side jobs (no auth context).
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Managers (owner or inviter) have full update access.
    IF NEW.invited_by = auth.uid() OR public.is_project_owner(NEW.project_id) THEN
        RETURN NEW;
    END IF;

    -- From here the caller is the partner (RLS already limits
    -- updates to manager or own partner row).
    IF NEW.project_id       IS DISTINCT FROM OLD.project_id
       OR NEW.partner_id    IS DISTINCT FROM OLD.partner_id
       OR NEW.invited_by    IS DISTINCT FROM OLD.invited_by
       OR NEW.agreed_price_ore IS DISTINCT FROM OLD.agreed_price_ore
       OR NEW.currency      IS DISTINCT FROM OLD.currency
       OR NEW.message       IS DISTINCT FROM OLD.message
       OR NEW.settled_at    IS DISTINCT FROM OLD.settled_at
       OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Partnere kan kun ændre status på invitationen' USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'invited'     AND NEW.status IN ('negotiating', 'declined'))
            OR (OLD.status = 'negotiating' AND NEW.status = 'declined')
        ) THEN
            RAISE EXCEPTION 'Ugyldig statusændring' USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_partners_guard_update ON public.project_partners;

CREATE TRIGGER project_partners_guard_update
  BEFORE UPDATE ON public.project_partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_partner_invite_update();

-- When the invited partner responds in the thread the invite
-- automatically moves invited -> negotiating.
CREATE OR REPLACE FUNCTION public.handle_partner_negotiation_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.project_partners pp
    SET status = 'negotiating'
    WHERE pp.id = NEW.partner_invite_id
      AND pp.status = 'invited'
      AND pp.partner_id = NEW.sender_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS partner_negotiation_message_inserted ON public.partner_negotiation_messages;

CREATE TRIGGER partner_negotiation_message_inserted
  AFTER INSERT ON public.partner_negotiation_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_partner_negotiation_message();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS policies
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.project_partners             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_task_access          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_negotiation_messages ENABLE ROW LEVEL SECURITY;

-- project_partners: both parties can read their own invitations.
DROP POLICY IF EXISTS "partner_invites_select_party" ON public.project_partners;
CREATE POLICY "partner_invites_select_party" ON public.project_partners
    FOR SELECT TO authenticated
    USING (
        partner_id = auth.uid()
        OR invited_by = auth.uid()
        OR public.is_project_owner(project_id)
    );

-- project_partners: only project owner/manager can invite, and
-- the inviter must be the caller.
DROP POLICY IF EXISTS "partner_invites_insert_manager" ON public.project_partners;
CREATE POLICY "partner_invites_insert_manager" ON public.project_partners
    FOR INSERT TO authenticated
    WITH CHECK (
        invited_by = auth.uid()
        AND partner_id <> auth.uid()
        AND (
            public.is_project_owner(project_id)
            OR public.get_user_project_role(project_id) = 'MANAGER'
        )
    );

-- project_partners: manager full update.
DROP POLICY IF EXISTS "partner_invites_update_manager" ON public.project_partners;
CREATE POLICY "partner_invites_update_manager" ON public.project_partners
    FOR UPDATE TO authenticated
    USING (invited_by = auth.uid() OR public.is_project_owner(project_id))
    WITH CHECK (invited_by = auth.uid() OR public.is_project_owner(project_id));

-- project_partners: partner may update own row — the trigger
-- guard above restricts the change to status transitions only.
DROP POLICY IF EXISTS "partner_invites_update_partner" ON public.project_partners;
CREATE POLICY "partner_invites_update_partner" ON public.project_partners
    FOR UPDATE TO authenticated
    USING (partner_id = auth.uid())
    WITH CHECK (partner_id = auth.uid());

-- project_partners: only manager can delete.
DROP POLICY IF EXISTS "partner_invites_delete_manager" ON public.project_partners;
CREATE POLICY "partner_invites_delete_manager" ON public.project_partners
    FOR DELETE TO authenticated
    USING (invited_by = auth.uid() OR public.is_project_owner(project_id));

-- partner_task_access: both parties can read the allowlist.
DROP POLICY IF EXISTS "partner_task_access_select_party" ON public.partner_task_access;
CREATE POLICY "partner_task_access_select_party" ON public.partner_task_access
    FOR SELECT TO authenticated
    USING (public.is_partner_invite_party(partner_invite_id));

-- partner_task_access: only manager can grant access, and only
-- to tasks belonging to the invitation's project.
DROP POLICY IF EXISTS "partner_task_access_insert_manager" ON public.partner_task_access;
CREATE POLICY "partner_task_access_insert_manager" ON public.partner_task_access
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_partner_invite_manager(partner_invite_id)
        AND EXISTS (
            SELECT 1
            FROM public.tasks t
            JOIN public.project_partners pp ON pp.id = partner_invite_id
            WHERE t.id = task_id AND t.project_id = pp.project_id
        )
    );

-- partner_task_access: only manager can revoke access.
DROP POLICY IF EXISTS "partner_task_access_delete_manager" ON public.partner_task_access;
CREATE POLICY "partner_task_access_delete_manager" ON public.partner_task_access
    FOR DELETE TO authenticated
    USING (public.is_partner_invite_manager(partner_invite_id));

-- partner_negotiation_messages: both parties read the thread.
DROP POLICY IF EXISTS "partner_messages_select_party" ON public.partner_negotiation_messages;
CREATE POLICY "partner_messages_select_party" ON public.partner_negotiation_messages
    FOR SELECT TO authenticated
    USING (public.is_partner_invite_party(partner_invite_id));

-- partner_negotiation_messages: parties write as themselves on
-- open (not declined/cancelled) invitations.
DROP POLICY IF EXISTS "partner_messages_insert_party" ON public.partner_negotiation_messages;
CREATE POLICY "partner_messages_insert_party" ON public.partner_negotiation_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_partner_invite_party(partner_invite_id)
        AND EXISTS (
            SELECT 1 FROM public.project_partners pp
            WHERE pp.id = partner_invite_id
              AND pp.status IN ('invited', 'negotiating', 'accepted')
        )
    );

-- tasks: partners may SELECT only their explicitly allowlisted
-- tasks (in addition to the existing project-member policy).
-- NOTE: deliberately NO equivalent policy on public.projects —
-- partners must use get_partner_project_view() and never see the
-- full project row (budget / team / internal notes).
DROP POLICY IF EXISTS "tasks_select_partner_access" ON public.tasks;
CREATE POLICY "tasks_select_partner_access" ON public.tasks
    FOR SELECT TO authenticated
    USING (public.has_partner_task_access(id));

-- tasks: accepted partners can update their allowlisted tasks
-- (status, checklist, comments) — settlement activates access.
DROP POLICY IF EXISTS "tasks_update_partner_accepted" ON public.tasks;
CREATE POLICY "tasks_update_partner_accepted" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.partner_task_access pta
            JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
            WHERE pta.task_id = tasks.id
              AND pp.partner_id = auth.uid()
              AND pp.status = 'accepted'
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 5. RPC: get_partner_project_view(p_project_id)
--    The ONLY way partners read project data: name, description
--    and deadline. Returns the row for members/owners too so the
--    same scoped page works for any authorized caller.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_partner_project_view(p_project_id UUID)
RETURNS TABLE (
    id          UUID,
    name        TEXT,
    description TEXT,
    deadline    DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
        SELECT p.id, p.name, p.description, p.end_date
        FROM public.projects p
        WHERE p.id = p_project_id
          AND (
              p.owner_id = auth.uid()
              OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
              OR EXISTS (
                  SELECT 1 FROM public.project_partners pp
                  WHERE pp.project_id = p.id
                    AND pp.partner_id = auth.uid()
                    AND pp.status IN ('invited', 'negotiating', 'accepted')
              )
          );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_project_view(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC: invite_partner(...)
--    Atomic: invite row + task allowlist + opening message/offer
--    + notification to the partner.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_partner(
    p_project_id        UUID,
    p_partner_id        UUID,
    p_task_ids          UUID[],
    p_message           TEXT   DEFAULT NULL,
    p_opening_price_ore BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller      UUID := auth.uid();
    v_project     public.projects%ROWTYPE;
    v_invite_id   UUID;
    v_caller_name TEXT;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Projekt ikke fundet' USING ERRCODE = '02000';
    END IF;

    IF NOT (v_project.owner_id = v_caller OR public.get_user_project_role(p_project_id) = 'MANAGER') THEN
        RAISE EXCEPTION 'Kun projektejer eller manager kan invitere partnere' USING ERRCODE = '42501';
    END IF;

    IF p_partner_id = v_caller THEN
        RAISE EXCEPTION 'Du kan ikke invitere dig selv' USING ERRCODE = '23514';
    END IF;

    IF p_task_ids IS NULL OR array_length(p_task_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Vælg mindst én opgave' USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.project_partners
        WHERE project_id = p_project_id AND partner_id = p_partner_id AND status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Partneren er allerede tilknyttet projektet' USING ERRCODE = '23505';
    END IF;

    PERFORM set_config('app.partner_invite_rpc', 'on', true);

    -- Re-inviting a declined/cancelled partner resets the invite.
    INSERT INTO public.project_partners (project_id, partner_id, invited_by, status, currency, message)
    VALUES (p_project_id, p_partner_id, v_caller, 'invited', 'DKK', p_message)
    ON CONFLICT (project_id, partner_id) DO UPDATE
        SET status           = 'invited',
            invited_by       = EXCLUDED.invited_by,
            message          = EXCLUDED.message,
            agreed_price_ore = NULL,
            settled_at       = NULL
    RETURNING id INTO v_invite_id;

    -- Replace the task allowlist (only tasks in this project).
    DELETE FROM public.partner_task_access WHERE partner_invite_id = v_invite_id;
    INSERT INTO public.partner_task_access (partner_invite_id, task_id)
    SELECT v_invite_id, t.id
    FROM public.tasks t
    WHERE t.id = ANY(p_task_ids) AND t.project_id = p_project_id
    ON CONFLICT (partner_invite_id, task_id) DO NOTHING;

    -- Opening message / opening offer in the negotiation thread.
    IF p_message IS NOT NULL AND length(trim(p_message)) > 0 THEN
        INSERT INTO public.partner_negotiation_messages (partner_invite_id, sender_id, kind, body)
        VALUES (v_invite_id, v_caller, 'message', p_message);
    END IF;

    IF p_opening_price_ore IS NOT NULL AND p_opening_price_ore > 0 THEN
        INSERT INTO public.partner_negotiation_messages (partner_invite_id, sender_id, kind, body, amount_ore)
        VALUES (v_invite_id, v_caller, 'offer', 'Åbningstilbud', p_opening_price_ore);
    END IF;

    -- Notify the partner.
    SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller;
    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        p_partner_id,
        COALESCE(v_caller_name, 'En projektleder') || ' har inviteret dig som underleverandør på projektet "' || v_project.name || '"',
        '#/partner-project/' || p_project_id,
        'partner_invite',
        jsonb_build_object('invite_id', v_invite_id, 'project_id', p_project_id)
    );

    RETURN v_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_partner(UUID, UUID, UUID[], TEXT, BIGINT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: accept_partner_invite(p_invite_id, p_agreed_price_ore)
--    Either party accepts the counterpart's latest offer:
--    settles the price, audit-stamps settled_at, logs an
--    'accept' thread event and notifies the other party.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_partner_invite(
    p_invite_id        UUID,
    p_agreed_price_ore BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller       UUID := auth.uid();
    v_invite       public.project_partners%ROWTYPE;
    v_is_manager   BOOLEAN;
    v_other_party  UUID;
    v_caller_name  TEXT;
    v_project_name TEXT;
BEGIN
    SELECT * INTO v_invite FROM public.project_partners WHERE id = p_invite_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
    END IF;

    v_is_manager := v_invite.invited_by = v_caller
        OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = v_invite.project_id AND p.owner_id = v_caller);

    IF NOT (v_is_manager OR v_invite.partner_id = v_caller) THEN
        RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
    END IF;

    IF v_invite.status NOT IN ('invited', 'negotiating') THEN
        RAISE EXCEPTION 'Invitationen kan ikke længere accepteres' USING ERRCODE = '23514';
    END IF;

    IF p_agreed_price_ore IS NULL OR p_agreed_price_ore <= 0 THEN
        RAISE EXCEPTION 'Ugyldig aftalt pris' USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('app.partner_invite_rpc', 'on', true);

    UPDATE public.project_partners
    SET status           = 'accepted',
        agreed_price_ore = p_agreed_price_ore,
        settled_at       = now()
    WHERE id = p_invite_id;

    INSERT INTO public.partner_negotiation_messages (partner_invite_id, sender_id, kind, body, amount_ore)
    VALUES (p_invite_id, v_caller, 'accept', 'Tilbud accepteret', p_agreed_price_ore);

    -- Notify the other party.
    v_other_party := CASE WHEN v_caller = v_invite.partner_id THEN v_invite.invited_by ELSE v_invite.partner_id END;
    SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller;
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_invite.project_id;

    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_other_party,
        COALESCE(v_caller_name, 'Modparten') || ' har accepteret aftalen på "' || COALESCE(v_project_name, 'projektet')
            || '" til ' || to_char(p_agreed_price_ore / 100.0, 'FM999G999G990D00') || ' ' || v_invite.currency,
        '#/partner-project/' || v_invite.project_id,
        'partner_invite_accepted',
        jsonb_build_object('invite_id', p_invite_id, 'project_id', v_invite.project_id, 'agreed_price_ore', p_agreed_price_ore)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_partner_invite(UUID, BIGINT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. RPC: decline_partner_invite(p_invite_id)
--    Partner declines; logs a 'decline' event + notifies inviter.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decline_partner_invite(p_invite_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller       UUID := auth.uid();
    v_invite       public.project_partners%ROWTYPE;
    v_caller_name  TEXT;
    v_project_name TEXT;
BEGIN
    SELECT * INTO v_invite
    FROM public.project_partners
    WHERE id = p_invite_id
      AND partner_id = v_caller
      AND status IN ('invited', 'negotiating');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
    END IF;

    PERFORM set_config('app.partner_invite_rpc', 'on', true);

    UPDATE public.project_partners SET status = 'declined' WHERE id = p_invite_id;

    INSERT INTO public.partner_negotiation_messages (partner_invite_id, sender_id, kind, body)
    VALUES (p_invite_id, v_caller, 'decline', 'Invitation afvist');

    SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller;
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_invite.project_id;

    INSERT INTO public.notifications (user_id, text, link, type, metadata)
    VALUES (
        v_invite.invited_by,
        COALESCE(v_caller_name, 'Partneren') || ' har afvist din partnerinvitation på "' || COALESCE(v_project_name, 'projektet') || '"',
        '#/project-detail/' || v_invite.project_id,
        'partner_invite_declined',
        jsonb_build_object('invite_id', p_invite_id, 'project_id', v_invite.project_id)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_partner_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. RPC: get_my_partner_invites()
--    Partner-side list across projects. SECURITY DEFINER so it
--    can join projects/profiles for the scoped fields (name,
--    deadline, inviter) without granting partners table access.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_partner_invites()
RETURNS TABLE (
    invite_id        UUID,
    project_id       UUID,
    project_name     TEXT,
    project_deadline DATE,
    invited_by       UUID,
    inviter_name     TEXT,
    inviter_initials TEXT,
    status           TEXT,
    agreed_price_ore BIGINT,
    currency         TEXT,
    message          TEXT,
    task_count       BIGINT,
    created_at       TIMESTAMPTZ,
    settled_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
        SELECT
            pp.id,
            pp.project_id,
            p.name,
            p.end_date,
            pp.invited_by,
            pr.name,
            pr.initials,
            pp.status,
            pp.agreed_price_ore,
            pp.currency,
            pp.message,
            (SELECT COUNT(*) FROM public.partner_task_access pta WHERE pta.partner_invite_id = pp.id),
            pp.created_at,
            pp.settled_at
        FROM public.project_partners pp
        JOIN public.projects p  ON p.id = pp.project_id
        JOIN public.profiles pr ON pr.id = pp.invited_by
        WHERE pp.partner_id = auth.uid()
        ORDER BY pp.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_partner_invites() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 10. Realtime: live negotiation thread + invite status changes.
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_negotiation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_partners;
