-- When a user accepts a quick-task invite that belongs to a project,
-- that project should appear in their "Mine Projekter" list.
-- Extend get_projects_guarded to include projects where the user has
-- active quick_task_access for a task that belongs to the project.

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
      OR EXISTS (
        SELECT 1 FROM public.quick_task_access qta
        JOIN public.tasks t ON t.id = qta.task_id
        WHERE qta.user_id  = auth.uid()
          AND qta.status   = 'active'
          AND t.project_id = p.id
      )
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_guarded() TO authenticated;
