-- ============================================================
-- MIGRATION: get_task_time_total RPC
--
-- Exposes a SECURITY DEFINER aggregate that returns the sum of
-- hours logged on a task. By running as the function owner it
-- bypasses the time_entries row-level security, but only after
-- verifying that the caller is either a project member or an
-- accepted partner with task access.
--
-- This fixes the partner-facing "Total tid på opgaven" display
-- which was previously limited to the caller's own rows.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_task_time_total(p_task_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC;
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM public.tasks WHERE id = p_task_id;

    -- Gate: caller must be owner/manager, a project member, a resource with task access,
    -- or the owner/assignee of a quick task (project_id IS NULL).
    IF NOT (
        (v_project_id IS NOT NULL AND public.is_project_member(v_project_id))
        OR public.has_partner_task_access(p_task_id)
        OR public.is_quick_task_accessible(p_task_id)
    ) THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(SUM(hours), 0)
    INTO v_total
    FROM public.time_entries
    WHERE task_id = p_task_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_task_time_total(UUID) TO authenticated;
