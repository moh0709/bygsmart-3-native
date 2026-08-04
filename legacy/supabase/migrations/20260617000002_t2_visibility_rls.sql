-- ============================================================
-- MIGRATION: T2 — Per-Member Visibility + RLS Enforcement
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Add created_by to reminders for ownership scoping
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Budget isolation helper function
--    Returns true if the caller may see project budget fields.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_view_project_budget(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Project owner always yes
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = auth.uid()) THEN
    RETURN TRUE;
  END IF;
  -- Manager role via team array
  IF public.get_user_project_role(p_project_id) = 'MANAGER' THEN
    RETURN TRUE;
  END IF;
  -- Resource with visibility='all'
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND visibility = 'all'
      AND status     = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_view_project_budget(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Tasks SELECT policy — scope restricted members
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_task_visible_to_resource(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.project_resources pr ON pr.project_id = t.project_id
    WHERE t.id = p_task_id
      AND pr.user_id = auth.uid()
      AND pr.status IN ('pending', 'active')
      AND (
        pr.visibility = 'all'
        OR (t.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text)))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_task_visible_to_resource(UUID) TO authenticated;

DROP POLICY IF EXISTS "tasks_select_partner_access" ON public.tasks;

CREATE POLICY "tasks_select_resource_access" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_member(project_id)
    OR public.is_task_visible_to_resource(id)
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Punch List — allow any active project_resource (incl. partner)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_active_project_resource(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only 'active' resources count; pending invites are not yet accepted readers.
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND status     = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_active_project_resource(UUID) TO authenticated;

DROP POLICY IF EXISTS "punch_list_layouts_select_project_member" ON public.punch_list_layouts;

CREATE POLICY "punch_list_layouts_select" ON public.punch_list_layouts
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_member(project_id)
    OR public.is_active_project_resource(project_id)
  );

DROP POLICY IF EXISTS "punch_list_items_select_project_member" ON public.punch_list_items;

CREATE POLICY "punch_list_items_select" ON public.punch_list_items
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_member(project_id)
    OR public.is_active_project_resource(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Reminders SELECT — scope to created_by for restricted resources
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reminders_select_project_member" ON public.reminders;
DROP POLICY IF EXISTS "reminders_project_member" ON public.reminders;

CREATE POLICY "reminders_select" ON public.reminders
  FOR SELECT TO authenticated
  USING (
    -- Owner and manager always see all reminders (including legacy NULL created_by rows)
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (
      public.is_project_member(project_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = reminders.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility = 'all'
            AND pr.status IN ('active', 'pending')
        )
        OR created_by = auth.uid()
      )
    )
    OR (
      public.is_active_project_resource(project_id)
      AND created_by = auth.uid()
    )
  );

-- Reminder INSERT: any active project member may create reminders
DROP POLICY IF EXISTS "reminders_insert" ON public.reminders;
CREATE POLICY "reminders_insert" ON public.reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR public.is_project_member(project_id)
  );

-- Reminder UPDATE: owner/manager update any; members only update their own
DROP POLICY IF EXISTS "reminders_update" ON public.reminders;
CREATE POLICY "reminders_update" ON public.reminders
  FOR UPDATE TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (
      public.is_project_member(project_id)
      AND created_by = auth.uid()
    )
  );

-- Reminder DELETE: owner/manager delete any; members only delete their own
DROP POLICY IF EXISTS "reminders_delete" ON public.reminders;
CREATE POLICY "reminders_delete" ON public.reminders
  FOR DELETE TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (
      public.is_project_member(project_id)
      AND created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Tasks SELECT — replace broad is_project_member() with
--    visibility-aware policy driven by project_resources
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select_project_member"  ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_resource_access" ON public.tasks;

-- Owner and manager always see all project tasks.
-- Staff with visibility='all' see all tasks.
-- Staff with standard/some visibility see only tasks they are assigned to.
-- Partners are handled by tasks_select_partner_access (resource_task_access).
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
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. Time entries SELECT — restrict non-managers to their own rows
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;

CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR EXISTS (
      SELECT 1 FROM public.project_resources pr
      WHERE pr.project_id = time_entries.project_id
        AND pr.user_id    = auth.uid()
        AND pr.visibility = 'all'
        AND pr.status IN ('pending', 'active')
    )
    OR (
      user_id = auth.uid()
      AND (
        public.is_project_member(project_id)
        OR public.is_active_project_resource(project_id)
      )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 8. Purchases SELECT — hide from restricted (non-all) resources
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "purchases_select_project_member" ON public.purchases;

CREATE POLICY "purchases_select_project_member" ON public.purchases
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR EXISTS (
      SELECT 1 FROM public.project_resources pr
      WHERE pr.project_id = purchases.project_id
        AND pr.user_id    = auth.uid()
        AND pr.visibility = 'all'
        AND pr.status IN ('pending', 'active')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 9. get_project_guarded — returns project row with budget
--    conditionally nulled for non-privileged callers.
--    Replaces client-side budget deletion in getProjectById().
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_project_guarded(p_project_id UUID)
RETURNS TABLE (
  id               UUID,
  owner_id         UUID,
  project_number   TEXT,
  name             TEXT,
  client_name      TEXT,
  status           TEXT,
  progress         INTEGER,
  start_date       DATE,
  end_date         DATE,
  address          TEXT,
  description      TEXT,
  regulation_count INTEGER,
  checklist_count  INTEGER,
  is_favorite      BOOLEAN,
  floor_plan_url   TEXT,
  milestone        JSONB,
  team             JSONB,
  budget           JSONB,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.owner_id,
      p.project_number,
      p.name,
      p.client_name,
      p.status,
      p.progress,
      p.start_date,
      p.end_date,
      p.address,
      p.description,
      p.regulation_count,
      p.checklist_count,
      p.is_favorite,
      p.floor_plan_url,
      p.milestone,
      p.team,
      CASE
        WHEN public.can_view_project_budget(p.id) THEN p.budget
        ELSE NULL
      END AS budget,
      p.created_at,
      p.updated_at
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        p.owner_id = auth.uid()
        OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
        OR EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = p.id
            AND pr.user_id = auth.uid()
            AND pr.status IN ('pending', 'active')
            AND pr.kind != 'partner'
        )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_guarded(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 10. get_projects_guarded — returns all accessible projects with
--     budget conditionally nulled for non-privileged callers.
--     Used by getProjects() instead of projects.select() to
--     prevent budget fields leaking over the wire.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_projects_guarded()
RETURNS TABLE (
  id               UUID,
  owner_id         UUID,
  project_number   TEXT,
  name             TEXT,
  client_name      TEXT,
  status           TEXT,
  progress         INTEGER,
  start_date       DATE,
  end_date         DATE,
  address          TEXT,
  description      TEXT,
  regulation_count INTEGER,
  checklist_count  INTEGER,
  is_favorite      BOOLEAN,
  floor_plan_url   TEXT,
  milestone        JSONB,
  team             JSONB,
  budget           JSONB,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.owner_id,
      p.project_number,
      p.name,
      p.client_name,
      p.status,
      p.progress,
      p.start_date,
      p.end_date,
      p.address,
      p.description,
      p.regulation_count,
      p.checklist_count,
      p.is_favorite,
      p.floor_plan_url,
      p.milestone,
      p.team,
      CASE
        WHEN public.can_view_project_budget(p.id) THEN p.budget
        ELSE NULL
      END AS budget,
      p.created_at,
      p.updated_at
    FROM public.projects p
    WHERE
      p.owner_id = auth.uid()
      OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = p.id
          AND pr.user_id    = auth.uid()
          AND pr.status IN ('pending', 'active')
          AND pr.kind       != 'partner'
      )
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_guarded() TO authenticated;
