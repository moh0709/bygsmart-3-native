-- ============================================================
-- MIGRATION: fix set_task_disabled_tabs' always-on allowlist.
--
-- 20260710000004 used ['overblik','tid','chat'], anticipating a
-- separate "Tid" tab from the full merged tab list in the task-
-- workspace design. That tab hasn't been built — today's actual
-- tab registry (pages/TaskDetailPage/constants.ts) is
-- overblik/filer/chat/dokumentation/team — so 'tid' never matched
-- anything. Correct the allowlist to the tabs that actually exist
-- and must stay on: overblik (status/handover) and chat.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_task_disabled_tabs(p_task_id UUID, p_disabled_tabs TEXT[])
RETURNS VOID AS $$
DECLARE
    v_allowed TEXT[];
BEGIN
    IF public.get_effective_task_role(p_task_id) NOT IN ('owner', 'responsible') THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(ARRAY(
        SELECT unnest(p_disabled_tabs)
        EXCEPT
        SELECT unnest(ARRAY['overblik', 'chat'])
    ), '{}') INTO v_allowed;

    UPDATE public.tasks SET disabled_tabs = v_allowed WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
