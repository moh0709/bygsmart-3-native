-- get_project_guarded (singular) had the same partner exclusion bug as
-- get_projects_guarded: AND pr.kind != 'partner' blocked active partners
-- from opening a project detail page ("Projekt ikke fundet eller ingen adgang").
-- Apply the same access rules: staff show on pending+active, partners on active only,
-- plus quick_task_access for task-level invitees.

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
            AND (
              (pr.kind != 'partner' AND pr.status IN ('pending', 'active'))
              OR (pr.kind = 'partner'  AND pr.status = 'active')
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.quick_task_access qta
          JOIN public.tasks t ON t.id = qta.task_id
          WHERE qta.user_id = auth.uid()
            AND qta.status  = 'active'
            AND t.project_id = p.id
        )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_guarded(UUID) TO authenticated;
