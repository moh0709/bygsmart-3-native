-- ============================================================
-- MIGRATION: Quick-task RLS fixes
--
-- Restores owner/assignee semantics for quick-task workspace
-- access and adds missing time_entries and storage RLS.
--
-- Fixes:
--   1. is_quick_task_accessible() — include owner + assignee
--      (safe because fn is SECURITY DEFINER, bypasses tasks RLS)
--   2. time_entries — add insert + select policies for quick tasks
--   3. task-docs storage — add quick-tasks/<taskId>/... branch
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Restore owner + assignee semantics in is_quick_task_accessible
--
--    The recursion fix (20260618000003) stripped owner/assignee
--    checks to break the tasks → qta → tasks recursion cycle.
--    Now that the function is SECURITY DEFINER it runs as the
--    function owner (postgres), bypasses tasks RLS, and can query
--    the tasks table directly — no recursion is possible.
--
--    Downstream consumers that call is_quick_task_accessible() —
--    task_docs_*, task_check_ins_*, task_handovers_* policies and
--    get_task_time_total() — all gain owner/assignee recognition
--    automatically once this function is updated.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_accessible(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Owner / assignee check (SECURITY DEFINER bypasses tasks RLS — no recursion)
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.scope = 'quick'
      AND (
        t.owner_id = auth.uid()
        OR t.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      )
  ) THEN
    RETURN true;
  END IF;
  -- Delegated access via quick_task_access
  RETURN EXISTS (
    SELECT 1 FROM public.quick_task_access qta
    WHERE qta.task_id = p_task_id
      AND qta.user_id = auth.uid()
      AND qta.status IN ('pending', 'active')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_quick_task_accessible(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. time_entries — quick-task insert + select policies
--
--    The baseline time_entries_insert_own policy requires
--    is_project_member(project_id), which is false for NULL.
--    checkOutOfTask() inserts time entries with project_id = null
--    for quick tasks — those rows need a dedicated policy branch.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "time_entries_insert_quick" ON public.time_entries;
CREATE POLICY "time_entries_insert_quick" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND project_id IS NULL
        AND task_id IS NOT NULL
        AND public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "time_entries_select_quick" ON public.time_entries;
CREATE POLICY "time_entries_select_quick" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        project_id IS NULL
        AND task_id IS NOT NULL
        AND public.is_quick_task_accessible(task_id)
    );

-- ─────────────────────────────────────────────────────────────
-- 3. Storage: task-docs bucket — quick-tasks/<taskId>/... paths
--
--    uploadTaskFile() uses the prefix quick-tasks/<taskId>/...
--    when projectId is null. The existing storage policies only
--    authorise signatures/... and <projectId>/<taskId>/... paths;
--    quick-task uploads were rejected at the bucket layer.
-- ─────────────────────────────────────────────────────────────

-- Helper: returns true when object lives under quick-tasks/<taskId>/...
-- and the caller has quick-task access to that task.
CREATE OR REPLACE FUNCTION public.storage_taskdocs_quick_task(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_seg1    TEXT;
    v_seg2    TEXT;
    v_task_id UUID;
BEGIN
    v_seg1 := split_part(object_name, '/', 1);
    IF v_seg1 <> 'quick-tasks' THEN RETURN FALSE; END IF;
    v_seg2 := split_part(object_name, '/', 2);
    IF v_seg2 = '' THEN RETURN FALSE; END IF;
    BEGIN
        v_task_id := v_seg2::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;
    RETURN public.is_quick_task_accessible(v_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- SELECT: download / generate signed URL
DROP POLICY IF EXISTS "task_docs_storage_select" ON storage.objects;
CREATE POLICY "task_docs_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_accepted_partner(name)
            OR public.storage_taskdocs_quick_task(name)
        )
    );

-- INSERT: upload
DROP POLICY IF EXISTS "task_docs_storage_insert" ON storage.objects;
CREATE POLICY "task_docs_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_accepted_partner(name)
            OR public.storage_taskdocs_quick_task(name)
        )
    );

-- DELETE: quick-task participants can delete their uploaded files
DROP POLICY IF EXISTS "task_docs_storage_delete" ON storage.objects;
CREATE POLICY "task_docs_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_quick_task(name)
        )
    );
