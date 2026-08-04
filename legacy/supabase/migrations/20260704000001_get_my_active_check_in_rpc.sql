-- ============================================================
-- MIGRATION: get_my_active_check_in RPC
--
-- getMyActiveCheckIn() previously read task_check_ins with a
-- PostgREST inner embed on tasks (tasks!inner(...)). The joined
-- tables' RLS is enforced too, and tasks_select is narrower than
-- task_check_ins_select (no accepted-partner branch), so the
-- embed could silently drop an authorized open session and make
-- the client believe no check-in exists.
--
-- This SECURITY DEFINER function returns only the caller's own
-- open session (user_id = auth.uid()) — the exact row the caller
-- created under task_check_ins_insert — enriched with the task
-- title and project name, so no joined-table RLS can hide it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_active_check_in()
RETURNS TABLE (
    task_id       UUID,
    task_title    TEXT,
    project_name  TEXT,
    checked_in_at TIMESTAMPTZ
) AS $$
    SELECT
        ci.task_id,
        COALESCE(t.title, '') AS task_title,
        p.name                AS project_name,
        ci.checked_in_at
    FROM public.task_check_ins ci
    LEFT JOIN public.tasks    t ON t.id = ci.task_id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE ci.user_id = auth.uid()
      AND ci.checked_out_at IS NULL
    ORDER BY ci.checked_in_at DESC
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_my_active_check_in() TO authenticated;
