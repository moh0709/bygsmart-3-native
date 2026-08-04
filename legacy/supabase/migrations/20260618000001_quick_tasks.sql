-- ============================================================
-- MIGRATION: T5 — Quick Tasks (Standalone Single Tasks)
--
-- Adds scope, owner_id, archived_at to tasks. Makes project_id
-- nullable so quick tasks can exist without a project. Updates
-- RLS to allow owner/assignee access for quick tasks.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Extend tasks table
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS owner_id    uuid        NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope       text        NOT NULL DEFAULT 'project'
    CHECK (scope IN ('project','quick')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_owner_scope ON public.tasks(owner_id, scope);
CREATE INDEX IF NOT EXISTS idx_tasks_scope       ON public.tasks(scope);
CREATE INDEX IF NOT EXISTS idx_tasks_archived    ON public.tasks(archived_at)
  WHERE archived_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Make project_id nullable in workspace and time tables
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.task_documentation
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.task_check_ins
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.task_handovers
  ALTER COLUMN project_id DROP NOT NULL;

-- Allow quick-task time entries without a project context
ALTER TABLE public.time_entries
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN project_id DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────
-- 3. Extend project-task write policies to guard NULL project_id
--    NOTE: tasks_select_project_member is intentionally NOT
--    recreated here. The visibility-aware policy defined in
--    20260617000002_t2_visibility_rls.sql is preserved as-is.
--    Only write policies are adjusted below.
-- ─────────────────────────────────────────────────────────────

-- INSERT: owner/manager only, project_id must be non-null
DROP POLICY IF EXISTS "tasks_insert_owner_manager" ON public.tasks;
CREATE POLICY "tasks_insert_owner_manager" ON public.tasks FOR INSERT
  WITH CHECK (
    project_id IS NOT NULL AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
    )
  );

-- UPDATE: mirror T2 visibility rules — owner/manager/all-visibility resource,
-- or assigned member with standard/some visibility.  The previous broad
-- is_project_member() rule let any team member overwrite any task.
DROP POLICY IF EXISTS "tasks_update_project_member" ON public.tasks;
CREATE POLICY "tasks_update_project_member" ON public.tasks FOR UPDATE
  USING (
    project_id IS NOT NULL AND (
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
    )
  );

-- DELETE: owner/manager only, project_id must be non-null
DROP POLICY IF EXISTS "tasks_delete_owner_manager" ON public.tasks;
CREATE POLICY "tasks_delete_owner_manager" ON public.tasks FOR DELETE
  USING (
    project_id IS NOT NULL AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Quick task RLS policies
--    Owner can do anything. Assignee can select and update.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select_quick" ON public.tasks;
CREATE POLICY "tasks_select_quick" ON public.tasks FOR SELECT
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR EXISTS (
        SELECT 1 FROM public.quick_task_access qta
        WHERE qta.task_id = tasks.id
          AND qta.user_id = auth.uid()
          AND qta.status IN ('pending', 'active')
      )
    )
  );

DROP POLICY IF EXISTS "tasks_insert_quick" ON public.tasks;
CREATE POLICY "tasks_insert_quick" ON public.tasks FOR INSERT
  WITH CHECK (
    scope = 'quick'
    AND project_id IS NULL
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "tasks_update_quick" ON public.tasks;
CREATE POLICY "tasks_update_quick" ON public.tasks FOR UPDATE
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR EXISTS (
        SELECT 1 FROM public.quick_task_access qta
        WHERE qta.task_id = tasks.id
          AND qta.user_id = auth.uid()
          AND qta.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "tasks_delete_quick" ON public.tasks;
CREATE POLICY "tasks_delete_quick" ON public.tasks FOR DELETE
  USING (scope = 'quick' AND owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. Helper function: is_quick_task_accessible
--    Used by workspace tables whose RLS needs to check parent.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_accessible(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.scope = 'quick'
      AND (
        t.owner_id = auth.uid()
        OR t.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        OR EXISTS (
          SELECT 1 FROM public.quick_task_access qta
          WHERE qta.task_id = p_task_id
            AND qta.user_id = auth.uid()
            AND qta.status IN ('pending', 'active')
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_quick_task_accessible(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. Workspace table policies — extend to cover quick tasks
--    (project_id is now nullable; quick-task owner/assignee
--     must be able to access documentation, check-ins, handovers)
-- ─────────────────────────────────────────────────────────────

-- task_documentation
DROP POLICY IF EXISTS "task_docs_select" ON public.task_documentation;
CREATE POLICY "task_docs_select" ON public.task_documentation
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_docs_insert" ON public.task_documentation;
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
DROP POLICY IF EXISTS "task_check_ins_select" ON public.task_check_ins;
CREATE POLICY "task_check_ins_select" ON public.task_check_ins
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_check_ins_insert" ON public.task_check_ins;
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
DROP POLICY IF EXISTS "task_handovers_select" ON public.task_handovers;
CREATE POLICY "task_handovers_select" ON public.task_handovers
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_handovers_insert" ON public.task_handovers;
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

-- ─────────────────────────────────────────────────────────────
-- 7. quick_task_access — projectless delegation model
--    Allows quick-task owners to grant access to other users
--    without requiring a project_resources row.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quick_task_access (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  status     text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quick_task_access_task ON public.quick_task_access(task_id);
CREATE INDEX IF NOT EXISTS idx_quick_task_access_user ON public.quick_task_access(user_id);

ALTER TABLE public.quick_task_access ENABLE ROW LEVEL SECURITY;

-- Task owner or invited user can see the row
DROP POLICY IF EXISTS "qta_select" ON public.quick_task_access;
CREATE POLICY "qta_select" ON public.quick_task_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
    )
  );

-- Only the quick-task owner can grant access
DROP POLICY IF EXISTS "qta_insert" ON public.quick_task_access;
CREATE POLICY "qta_insert" ON public.quick_task_access
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
    )
  );

-- Invitee can update their own row (accept/decline); owner can update any
DROP POLICY IF EXISTS "qta_update_self" ON public.quick_task_access;
CREATE POLICY "qta_update_self" ON public.quick_task_access
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
    )
  );

-- Task owner or the invited user can revoke access
DROP POLICY IF EXISTS "qta_delete" ON public.quick_task_access;
CREATE POLICY "qta_delete" ON public.quick_task_access
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
    )
  );
