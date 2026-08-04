-- ============================================================
-- MIGRATION: generalize task-level role/access so quick_task_access
-- grants also work on PROJECT tasks (today they silently don't),
-- and introduce get_effective_task_role() as the single source of
-- truth for Owner/Responsible/Worker/Viewer, mirrored client-side
-- by components/taskWorkspace/roles.ts.
--
-- Note on is_quick_task_accessible(): its quick_task_access branch
-- (added in 20260621000001_quick_task_rls_fixes.sql) has NO scope
-- filter, so it already evaluates correctly for a project task's
-- task_id — it is reused as-is below rather than duplicated.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- is_task_owner: scope-agnostic "does auth.uid() own this task"
-- (quick-task owner_id, or the owning project's owner_id).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_task_owner(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
    v_owner_id   UUID;
BEGIN
    SELECT project_id, owner_id INTO v_project_id, v_owner_id
    FROM public.tasks WHERE id = p_task_id;

    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_owner_id = auth.uid() THEN RETURN TRUE; END IF;
    IF v_project_id IS NOT NULL AND public.is_project_owner(v_project_id) THEN RETURN TRUE; END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_task_owner(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- get_effective_task_role: single source of truth for the
-- Owner/Responsible/Worker/Viewer model. Precedence:
--   1. An explicit quick_task_access row for (task, caller) wins
--      outright — lets a task grant override normal project
--      membership (promote/restrict one person on one task).
--   2. Project task: project OWNER -> owner; project MANAGER ->
--      responsible; an assignee -> worker; any other project
--      member -> viewer.
--   3. Quick task: tasks.owner_id -> owner; legacy assignees
--      JSONB membership -> worker.
--   4. No access at all -> NULL.
-- SECURITY DEFINER: reads quick_task_access directly (same
-- established pattern as is_quick_task_participant/
-- is_quick_task_accessible), so no RLS recursion when called
-- from a policy ON quick_task_access itself.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_effective_task_role(p_task_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_project_id UUID;
    v_owner_id   UUID;
    v_assignees  JSONB;
    v_qta_role   TEXT;
    v_project_role TEXT;
BEGIN
    SELECT project_id, owner_id, assignees INTO v_project_id, v_owner_id, v_assignees
    FROM public.tasks WHERE id = p_task_id;

    IF NOT FOUND THEN RETURN NULL; END IF;

    -- 1. Explicit per-task grant always wins.
    SELECT role INTO v_qta_role
    FROM public.quick_task_access
    WHERE task_id = p_task_id
      AND user_id = auth.uid()
      AND status IN ('pending', 'active');
    IF v_qta_role IS NOT NULL THEN RETURN v_qta_role; END IF;

    -- 2. Project task defaults.
    IF v_project_id IS NOT NULL THEN
        IF public.is_project_owner(v_project_id) THEN RETURN 'owner'; END IF;
        v_project_role := public.get_user_project_role(v_project_id);
        IF v_project_role = 'MANAGER' THEN RETURN 'responsible'; END IF;
        IF v_assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT)) THEN RETURN 'worker'; END IF;
        IF public.is_project_member(v_project_id) THEN RETURN 'viewer'; END IF;
        RETURN NULL;
    END IF;

    -- 3. Quick task defaults.
    IF v_owner_id = auth.uid() THEN RETURN 'owner'; END IF;
    IF v_assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT)) THEN RETURN 'worker'; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_effective_task_role(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- tasks (project scope): let a quick_task_access grant also
-- unlock a project task, independent of project_resources.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select_project_member" ON public.tasks;
CREATE POLICY "tasks_select_project_member" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = tasks.project_id
          AND pr.user_id    = auth.uid()
          AND pr.visibility = 'all'
          AND pr.status IN ('pending', 'active')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = tasks.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility IN ('standard', 'some')
            AND pr.status IN ('pending', 'active')
        )
        AND tasks.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      )
      OR public.is_quick_task_accessible(tasks.id)
    )
  );

DROP POLICY IF EXISTS "tasks_update_project_member" ON public.tasks;
CREATE POLICY "tasks_update_project_member" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = tasks.project_id
          AND pr.user_id    = auth.uid()
          AND pr.visibility = 'all'
          AND pr.status IN ('pending', 'active')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = tasks.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility IN ('standard', 'some')
            AND pr.status IN ('pending', 'active')
        )
        AND tasks.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      )
      OR public.is_quick_task_accessible(tasks.id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- quick_task_access: let a project OWNER/MANAGER manage grants
-- on their own project's tasks too, not just a quick-task owner.
-- Superseding is_quick_task_owner(task_id) with
-- get_effective_task_role(task_id) IN ('owner','responsible') in
-- the "grantor" branch of each policy (participant/self branches
-- unchanged).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "qta_select" ON public.quick_task_access;
CREATE POLICY "qta_select" ON public.quick_task_access
  FOR SELECT TO authenticated
  USING (
    public.is_quick_task_participant(task_id)
    OR public.get_effective_task_role(task_id) IN ('owner', 'responsible')
  );

DROP POLICY IF EXISTS "qta_insert" ON public.quick_task_access;
CREATE POLICY "qta_insert" ON public.quick_task_access
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.get_effective_task_role(task_id) IN ('owner', 'responsible')
  );

DROP POLICY IF EXISTS "qta_update_self" ON public.quick_task_access;
CREATE POLICY "qta_update_self" ON public.quick_task_access
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_effective_task_role(task_id) IN ('owner', 'responsible')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.get_effective_task_role(task_id) IN ('owner', 'responsible')
  );

DROP POLICY IF EXISTS "qta_delete" ON public.quick_task_access;
CREATE POLICY "qta_delete" ON public.quick_task_access
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_effective_task_role(task_id) IN ('owner', 'responsible')
  );

-- ─────────────────────────────────────────────────────────────
-- time_entries: the existing "_quick" policies (20260621000001)
-- require project_id IS NULL, so a task_access grant on a
-- PROJECT task still couldn't check in/out. Add a scope-agnostic
-- pair alongside them (additive; the "_quick" ones stay as-is).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "time_entries_select_task_access" ON public.time_entries;
CREATE POLICY "time_entries_select_task_access" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        task_id IS NOT NULL
        AND public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "time_entries_insert_task_access" ON public.time_entries;
CREATE POLICY "time_entries_insert_task_access" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND task_id IS NOT NULL
        AND public.is_quick_task_accessible(task_id)
    );
