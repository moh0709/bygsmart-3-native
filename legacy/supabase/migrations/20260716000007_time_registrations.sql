-- ============================================================
-- MIGRATION: weekly time registration (Tidsregistrering module page)
--
-- Staff register a week's work per task/day/interval in a wizard;
-- drafts persist server-side; Indsend submits to a responsible
-- approver (CEO-assigned via org_time_responsibles, fallback org
-- owner) who approves/rejects with a comment. Submitted hours
-- materialize into time_entries (tagged with registration_id) so
-- project views/budgets/exports stay one source of truth; a
-- rejection deletes the tagged rows so an edited+resubmitted week
-- can never double-count.
--
-- House patterns: SECURITY DEFINER STABLE helpers + RPC-only
-- privileged writes (20260713000002), GUC column guard
-- (protect_trial_columns, 20260703091211-era), table-qualified
-- columns in RETURNS/plpgsql (42702 lesson, 20260704134512).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Helper: is_org_owner (companion to is_org_member)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = p_org_id AND o.created_by = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.time_registrations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start       date NOT NULL, -- Monday of the ISO week
    status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    -- Wizard state, client-shaped:
    -- { version, step, tasks: [{ taskId, taskTitle, projectId|null, projectName|null,
    --   days: { 'YYYY-MM-DD': [{ startMin, endMin, note }] } }] }
    payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
    total_minutes    integer NOT NULL DEFAULT 0,
    responsible_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at     timestamptz,
    decided_at       timestamptz,
    decided_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision_comment text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    UNIQUE (org_id, user_id, week_start)
);

CREATE INDEX time_registrations_responsible_idx
    ON public.time_registrations(responsible_id, week_start);
CREATE INDEX time_registrations_org_week_idx
    ON public.time_registrations(org_id, week_start);

-- CEO-managed approver mapping: who reviews each staff member's weeks.
CREATE TABLE public.org_time_responsibles (
    org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    staff_user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    responsible_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at          timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (org_id, staff_user_id)
);

CREATE INDEX org_time_responsibles_responsible_idx
    ON public.org_time_responsibles(responsible_user_id);

-- Materialized weekly hours link back to their registration so a
-- rejection can clean them up.
ALTER TABLE public.time_entries
    ADD COLUMN IF NOT EXISTS registration_id uuid
    REFERENCES public.time_registrations(id) ON DELETE SET NULL;

ALTER TABLE public.time_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_time_responsibles ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

-- Drafts are private; submitted/decided weeks are visible to the
-- snapshotted responsible and to the org owner.
CREATE POLICY time_registrations_select ON public.time_registrations
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR (status <> 'draft'
            AND public.is_org_member(org_id)
            AND (responsible_id = auth.uid() OR public.is_org_owner(org_id)))
    );

CREATE POLICY time_registrations_insert ON public.time_registrations
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));

-- Staff edit their own week while it is draft or rejected (a rejection
-- reopens editing); status/decision columns are frozen by the trigger
-- below — transitions go through the RPCs only.
CREATE POLICY time_registrations_update ON public.time_registrations
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() AND status IN ('draft', 'rejected'))
    WITH CHECK (user_id = auth.uid());

-- Annuller: a draft can be discarded entirely.
CREATE POLICY time_registrations_delete ON public.time_registrations
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY org_time_responsibles_select ON public.org_time_responsibles
    FOR SELECT TO authenticated
    USING (public.is_org_member(org_id));

CREATE POLICY org_time_responsibles_insert ON public.org_time_responsibles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_time_responsibles_update ON public.org_time_responsibles
    FOR UPDATE TO authenticated
    USING (public.is_org_owner(org_id))
    WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_time_responsibles_delete ON public.org_time_responsibles
    FOR DELETE TO authenticated
    USING (public.is_org_owner(org_id));

-- ─────────────────────────────────────────────────────────────
-- Column guard: workflow columns move only via the RPCs (GUC
-- opt-out pattern, same as protect_trial_columns). Applies only to
-- end-user writes — service-role (auth.uid() IS NULL) is exempt.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_time_registration_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND COALESCE(current_setting('app.time_registration_rpc', true), '') <> 'on' THEN
        IF NEW.status           IS DISTINCT FROM OLD.status
        OR NEW.total_minutes    IS DISTINCT FROM OLD.total_minutes
        OR NEW.responsible_id   IS DISTINCT FROM OLD.responsible_id
        OR NEW.submitted_at     IS DISTINCT FROM OLD.submitted_at
        OR NEW.decided_at       IS DISTINCT FROM OLD.decided_at
        OR NEW.decided_by       IS DISTINCT FROM OLD.decided_by
        OR NEW.decision_comment IS DISTINCT FROM OLD.decision_comment THEN
            RAISE EXCEPTION 'Statusændringer sker via indsend/godkend/afvis.';
        END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER time_registrations_protect_workflow
    BEFORE UPDATE ON public.time_registrations
    FOR EACH ROW EXECUTE FUNCTION public.protect_time_registration_workflow();

-- ─────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────

-- Staff submits their week: validates intervals, snapshots the
-- responsible, materializes time_entries, notifies the responsible.
CREATE OR REPLACE FUNCTION public.submit_time_registration(p_registration_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reg          public.time_registrations%ROWTYPE;
    v_responsible  uuid;
    v_user_name    text;
    v_total        integer := 0;
    v_task         jsonb;
    v_day          text;
    v_interval     jsonb;
    v_start        integer;
    v_end          integer;
    v_note         text;
BEGIN
    SELECT * INTO v_reg FROM public.time_registrations tr
    WHERE tr.id = p_registration_id AND tr.user_id = auth.uid()
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registreringen blev ikke fundet.';
    END IF;
    IF v_reg.status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'Kun kladder og afviste registreringer kan indsendes.';
    END IF;
    IF COALESCE(jsonb_array_length(v_reg.payload -> 'tasks'), 0) = 0 THEN
        RAISE EXCEPTION 'Registreringen er tom — vælg mindst én opgave.';
    END IF;

    -- Responsible: CEO-assigned mapping, falling back to the org owner
    -- so a submission never dangles.
    SELECT otr.responsible_user_id INTO v_responsible
    FROM public.org_time_responsibles otr
    WHERE otr.org_id = v_reg.org_id AND otr.staff_user_id = v_reg.user_id;
    IF v_responsible IS NULL THEN
        SELECT o.created_by INTO v_responsible
        FROM public.organizations o WHERE o.id = v_reg.org_id;
    END IF;

    SELECT p.name INTO v_user_name FROM public.profiles p WHERE p.id = v_reg.user_id;

    -- A resubmission after rejection starts clean (reject already
    -- deleted the rows; defensive delete keeps this idempotent).
    DELETE FROM public.time_entries te WHERE te.registration_id = v_reg.id;

    -- Validate + total + materialize.
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_reg.payload -> 'tasks') LOOP
        FOR v_day IN SELECT * FROM jsonb_object_keys(COALESCE(v_task -> 'days', '{}'::jsonb)) LOOP
            FOR v_interval IN SELECT * FROM jsonb_array_elements(v_task -> 'days' -> v_day) LOOP
                v_start := COALESCE((v_interval ->> 'startMin')::integer, 0);
                v_end   := COALESCE((v_interval ->> 'endMin')::integer, 0);
                v_note  := NULLIF(TRIM(COALESCE(v_interval ->> 'note', '')), '');
                IF v_end <= v_start OR v_start < 0 OR v_end > 1440 THEN
                    RAISE EXCEPTION 'Ugyldigt tidsinterval (% – %) den %.',
                        v_start, v_end, v_day;
                END IF;
                v_total := v_total + (v_end - v_start);

                INSERT INTO public.time_entries
                    (project_id, task_id, user_id, user_name, hours, date, description, registration_id)
                VALUES (
                    NULLIF(v_task ->> 'projectId', '')::uuid,
                    NULLIF(v_task ->> 'taskId', '')::uuid,
                    v_reg.user_id,
                    COALESCE(v_user_name, ''),
                    ROUND(((v_end - v_start)::numeric / 60.0), 2),
                    v_day,
                    CONCAT(
                        LPAD((v_start / 60)::text, 2, '0'), ':', LPAD((v_start % 60)::text, 2, '0'),
                        '–',
                        LPAD((v_end / 60)::text, 2, '0'), ':', LPAD((v_end % 60)::text, 2, '0'),
                        COALESCE(' · ' || v_note, '')
                    ),
                    v_reg.id
                );
            END LOOP;
        END LOOP;
    END LOOP;

    IF v_total = 0 THEN
        RAISE EXCEPTION 'Registreringen indeholder ingen tid.';
    END IF;

    PERFORM set_config('app.time_registration_rpc', 'on', true);
    UPDATE public.time_registrations tr
    SET status = 'submitted',
        submitted_at = now(),
        responsible_id = v_responsible,
        total_minutes = v_total,
        decided_at = NULL,
        decided_by = NULL,
        decision_comment = NULL
    WHERE tr.id = v_reg.id;

    IF v_responsible IS NOT NULL AND v_responsible <> v_reg.user_id THEN
        INSERT INTO public.notifications (user_id, text, timestamp, is_read, link, type, metadata)
        VALUES (
            v_responsible,
            COALESCE(v_user_name, 'En medarbejder') || ' har indsendt tidsregistrering for uge '
                || to_char(v_reg.week_start, 'IW') || ' (' || ROUND(v_total / 60.0, 1) || ' timer).',
            now(),
            false,
            '/tidsregistrering?week=' || v_reg.week_start::text,
            'time_registration_submitted',
            jsonb_build_object('registration_id', v_reg.id, 'staff_user_id', v_reg.user_id)
        );
    END IF;
END;
$$;

-- Shared authority + transition core for approve/reject.
CREATE OR REPLACE FUNCTION public.decide_time_registration(
    p_registration_id UUID,
    p_approve BOOLEAN,
    p_comment TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reg        public.time_registrations%ROWTYPE;
    v_actor_name text;
BEGIN
    SELECT * INTO v_reg FROM public.time_registrations tr
    WHERE tr.id = p_registration_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registreringen blev ikke fundet.';
    END IF;
    IF v_reg.status <> 'submitted' THEN
        RAISE EXCEPTION 'Kun indsendte registreringer kan behandles.';
    END IF;
    IF NOT (v_reg.responsible_id = auth.uid() OR public.is_org_owner(v_reg.org_id)) THEN
        RAISE EXCEPTION 'Kun den ansvarlige eller organisationens ejer kan behandle registreringen.';
    END IF;
    IF NOT p_approve AND NULLIF(TRIM(COALESCE(p_comment, '')), '') IS NULL THEN
        RAISE EXCEPTION 'En afvisning kræver en kommentar.';
    END IF;

    IF NOT p_approve THEN
        -- Rejected hours must not linger in project views/budgets.
        DELETE FROM public.time_entries te WHERE te.registration_id = v_reg.id;
    END IF;

    PERFORM set_config('app.time_registration_rpc', 'on', true);
    UPDATE public.time_registrations tr
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        decided_at = now(),
        decided_by = auth.uid(),
        decision_comment = NULLIF(TRIM(COALESCE(p_comment, '')), '')
    WHERE tr.id = v_reg.id;

    SELECT p.name INTO v_actor_name FROM public.profiles p WHERE p.id = auth.uid();

    INSERT INTO public.notifications (user_id, text, timestamp, is_read, link, type, metadata)
    VALUES (
        v_reg.user_id,
        CASE WHEN p_approve
            THEN 'Din tidsregistrering for uge ' || to_char(v_reg.week_start, 'IW')
                 || ' er godkendt af ' || COALESCE(v_actor_name, 'din ansvarlige') || '.'
            ELSE 'Din tidsregistrering for uge ' || to_char(v_reg.week_start, 'IW')
                 || ' er afvist af ' || COALESCE(v_actor_name, 'din ansvarlige')
                 || ': ' || TRIM(p_comment)
        END,
        now(),
        false,
        '/tidsregistrering?week=' || v_reg.week_start::text,
        'time_registration_decided',
        jsonb_build_object('registration_id', v_reg.id, 'approved', p_approve)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_time_registration(
    p_registration_id UUID,
    p_comment TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.decide_time_registration(p_registration_id, true, p_comment);
$$;

CREATE OR REPLACE FUNCTION public.reject_time_registration(
    p_registration_id UUID,
    p_comment TEXT
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.decide_time_registration(p_registration_id, false, p_comment);
$$;

REVOKE ALL ON FUNCTION public.submit_time_registration(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_time_registration(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_time_registration(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_time_registration(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_time_registration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_time_registration(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_time_registration(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_time_registration(UUID, TEXT) TO authenticated;
