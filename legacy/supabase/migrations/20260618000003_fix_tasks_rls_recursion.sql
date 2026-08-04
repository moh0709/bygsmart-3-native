-- ============================================================
-- MIGRATION: Fix RLS infinite recursion on tasks table
--
-- ROOT CAUSE (PostgreSQL error 42P17):
--   tasks_select_quick queries quick_task_access via EXISTS.
--   quick_task_access.qta_select queries back into tasks via EXISTS.
--   => Mutual recursion: tasks → qta_select → tasks → qta_select → ...
--
-- FIX STRATEGY — break both sides of the recursion with SECURITY DEFINER:
--
--   is_quick_task_accessible(uuid)  [SECURITY DEFINER]
--     Only queries quick_task_access — never re-enters tasks table.
--     Safe to call from tasks RLS policies.
--
--   is_quick_task_owner(uuid)  [SECURITY DEFINER]
--     Queries tasks table as the function owner (postgres/superuser),
--     which bypasses tasks RLS entirely — no policy re-entry.
--     Safe to call from quick_task_access RLS policies.
--
--   tasks_*_quick policies: use current-row column refs (owner_id, assignees)
--     + is_quick_task_accessible(id) — no subquery into tasks.
--
--   qta_* policies: use is_quick_task_owner(task_id) — tasks RLS bypassed.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Step 1: Drop ALL policies that depend on is_quick_task_accessible
--         BEFORE dropping the function.
--
--   DROP order matters: PostgreSQL refuses to drop a function
--   while any policy references it, even with IF EXISTS. All six
--   workspace-table policies (task_docs_*, task_check_ins_*,
--   task_handovers_*) were created in migration 20260618000001
--   and must be dropped here before the function can be replaced.
--   The tasks quick policies and qta_* policies are also dropped
--   so the entire policy set is rebuilt cleanly below.
-- ─────────────────────────────────────────────────────────────

-- Workspace table policies (these are the ones that caused the error —
-- they reference is_quick_task_accessible and must go first)
DROP POLICY IF EXISTS "task_docs_select"      ON public.task_documentation;
DROP POLICY IF EXISTS "task_docs_insert"      ON public.task_documentation;
DROP POLICY IF EXISTS "task_check_ins_select" ON public.task_check_ins;
DROP POLICY IF EXISTS "task_check_ins_insert" ON public.task_check_ins;
DROP POLICY IF EXISTS "task_handovers_select" ON public.task_handovers;
DROP POLICY IF EXISTS "task_handovers_insert" ON public.task_handovers;

-- tasks quick policies (also reference is_quick_task_accessible)
DROP POLICY IF EXISTS "tasks_select_quick" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_quick" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_quick" ON public.tasks;

-- quick_task_access policies (rebuilt below using is_quick_task_owner)
DROP POLICY IF EXISTS "qta_select"      ON public.quick_task_access;
DROP POLICY IF EXISTS "qta_insert"      ON public.quick_task_access;
DROP POLICY IF EXISTS "qta_update_self" ON public.quick_task_access;
DROP POLICY IF EXISTS "qta_delete"      ON public.quick_task_access;

-- ─────────────────────────────────────────────────────────────
-- Step 2: Drop the old function (now safe — no dependents remain)
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.is_quick_task_accessible(UUID);

-- ─────────────────────────────────────────────────────────────
-- Step 3: Recreate is_quick_task_accessible
--   ONLY queries quick_task_access — never touches tasks table.
--   This breaks the tasks → qta → tasks recursion cycle.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_accessible(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check quick_task_access directly without re-querying tasks (avoids RLS recursion)
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
-- Step 4: Recreate is_quick_task_owner
--   SECURITY DEFINER runs as postgres (superuser) — tasks RLS is bypassed.
--   Used by quick_task_access policies to check ownership without
--   triggering tasks RLS again (the other side of the recursion).
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_owner(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Bypasses RLS by using SECURITY DEFINER; only checks owner_id and scope
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.owner_id = auth.uid()
      AND t.scope = 'quick'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_quick_task_owner(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Step 5: Recreate tasks quick policies
--   owner_id and assignees reference the CURRENT ROW — safe, no subquery.
--   is_quick_task_accessible only queries qta — no re-entry into tasks RLS.
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "tasks_select_quick" ON public.tasks FOR SELECT
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR public.is_quick_task_accessible(id)
    )
  );

CREATE POLICY "tasks_update_quick" ON public.tasks FOR UPDATE
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR public.is_quick_task_accessible(id)
    )
  );

CREATE POLICY "tasks_delete_quick" ON public.tasks FOR DELETE
  USING (scope = 'quick' AND owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Step 6: Recreate quick_task_access policies
--   Replace inline EXISTS (SELECT 1 FROM tasks ...) with
--   is_quick_task_owner(task_id) which bypasses tasks RLS.
-- ─────────────────────────────────────────────────────────────

-- Task owner or invited user can see the row
CREATE POLICY "qta_select" ON public.quick_task_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- Only the quick-task owner can grant access
CREATE POLICY "qta_insert" ON public.quick_task_access
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_quick_task_owner(task_id)
  );

-- Invitee can update their own row (accept/decline); owner can update any
CREATE POLICY "qta_update_self" ON public.quick_task_access
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- Task owner or the invited user can revoke access
CREATE POLICY "qta_delete" ON public.quick_task_access
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Step 7: Recreate workspace table policies
--   Copied verbatim from 20260618000001_quick_tasks.sql (step 6).
--   They were dropped above so the function could be replaced;
--   now that is_quick_task_accessible is the non-recursive version,
--   these policies are safe to recreate.
-- ─────────────────────────────────────────────────────────────

-- task_documentation
CREATE POLICY "task_docs_select" ON public.task_documentation
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

CREATE POLICY "task_docs_insert" ON public.task_documentation
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
        )
    );

-- task_check_ins
CREATE POLICY "task_check_ins_select" ON public.task_check_ins
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

CREATE POLICY "task_check_ins_insert" ON public.task_check_ins
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
        )
    );

-- task_handovers
CREATE POLICY "task_handovers_select" ON public.task_handovers
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

CREATE POLICY "task_handovers_insert" ON public.task_handovers
    FOR INSERT TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
        )
    );
