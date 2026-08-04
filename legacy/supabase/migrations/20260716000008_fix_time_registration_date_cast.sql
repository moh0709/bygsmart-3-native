-- Fix 42804 on submit_time_registration: jsonb_object_keys yields TEXT and
-- INSERT provides no implicit text→date cast for time_entries.date — the
-- first real submission failed with 'column "date" is of type date but
-- expression is of type text'. Cast v_day explicitly. Body otherwise
-- identical to 20260716000007.

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

    SELECT otr.responsible_user_id INTO v_responsible
    FROM public.org_time_responsibles otr
    WHERE otr.org_id = v_reg.org_id AND otr.staff_user_id = v_reg.user_id;
    IF v_responsible IS NULL THEN
        SELECT o.created_by INTO v_responsible
        FROM public.organizations o WHERE o.id = v_reg.org_id;
    END IF;

    SELECT p.name INTO v_user_name FROM public.profiles p WHERE p.id = v_reg.user_id;

    DELETE FROM public.time_entries te WHERE te.registration_id = v_reg.id;

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
                    v_day::date,
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
