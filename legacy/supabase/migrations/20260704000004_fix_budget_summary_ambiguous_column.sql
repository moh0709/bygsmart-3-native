-- get_project_budget_summary's RETURNS TABLE declares an output column named
-- labor_rate_dkk_per_hour, which PL/pgSQL treats as an implicit variable in the
-- function body scope. The initial `SELECT id, total_kr, labor_rate_dkk_per_hour
-- INTO ... FROM project_budgets` referenced that column unqualified, colliding
-- with the output variable ("column reference is ambiguous", ERRCODE 42702).
-- Fix: qualify all columns with the table alias so they resolve unambiguously.
-- Caught via live testing immediately after 20260704000002/000003.

CREATE OR REPLACE FUNCTION public.get_project_budget_summary(p_project_id UUID)
RETURNS TABLE (
  has_baseline                  BOOLEAN,
  planned_total_kr              NUMERIC,
  planned_materials_kr          NUMERIC,
  planned_labor_kr              NUMERIC,
  planned_subcontractors_kr     NUMERIC,
  planned_other_kr              NUMERIC,
  labor_rate_dkk_per_hour       NUMERIC,
  actual_purchases_forecast_kr  NUMERIC,
  actual_purchases_committed_kr NUMERIC,
  actual_purchases_received_kr  NUMERIC,
  actual_labor_kr               NUMERIC,
  actual_subcontractors_kr      NUMERIC,
  actual_total_kr               NUMERIC,
  remaining_kr                  NUMERIC,
  forecast_total_kr             NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_budget_id UUID;
  v_baseline_total NUMERIC;
  v_rate NUMERIC;
BEGIN
  IF NOT public.can_view_project_budget(p_project_id) THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  SELECT pb.id, pb.total_kr, pb.labor_rate_dkk_per_hour INTO v_budget_id, v_baseline_total, v_rate
  FROM public.project_budgets pb WHERE pb.project_id = p_project_id;

  RETURN QUERY
  WITH revision_totals AS (
    SELECT COALESCE(SUM(r.total_delta_kr), 0) AS delta_total
    FROM public.project_budget_revisions r WHERE r.project_budget_id = v_budget_id
  ),
  cat AS (
    SELECT
      COALESCE((SELECT SUM(c.amount_kr) FROM public.project_budget_categories c WHERE c.project_budget_id = v_budget_id AND c.category = 'materials'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'materials'), 0) AS materials,
      COALESCE((SELECT SUM(c.amount_kr) FROM public.project_budget_categories c WHERE c.project_budget_id = v_budget_id AND c.category = 'labor'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'labor'), 0) AS labor,
      COALESCE((SELECT SUM(c.amount_kr) FROM public.project_budget_categories c WHERE c.project_budget_id = v_budget_id AND c.category = 'subcontractors'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'subcontractors'), 0) AS subcontractors,
      COALESCE((SELECT SUM(c.amount_kr) FROM public.project_budget_categories c WHERE c.project_budget_id = v_budget_id AND c.category = 'other'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'other'), 0) AS other
  ),
  purch AS (
    SELECT
      COALESCE(SUM(pu.price * pu.quantity) FILTER (WHERE pu.status = 'Afventer'), 0) AS forecast,
      COALESCE(SUM(pu.price * pu.quantity) FILTER (WHERE pu.status = 'Bestilt'),  0) AS committed,
      COALESCE(SUM(pu.price * pu.quantity) FILTER (WHERE pu.status = 'Modtaget'), 0) AS received
    FROM public.purchases pu WHERE pu.project_id = p_project_id
  ),
  labor AS (
    SELECT COALESCE(SUM(te.hours * COALESCE(tbr.hourly_rate_dkk, v_rate, 0)), 0) AS cost
    FROM public.time_entries te
    LEFT JOIN public.task_budget_rates tbr ON tbr.task_id = te.task_id
    WHERE te.project_id = p_project_id
  ),
  sub AS (
    SELECT COALESCE(SUM(prr.agreed_price_ore), 0) / 100.0 AS cost
    FROM public.project_resources prr
    WHERE prr.project_id = p_project_id AND prr.kind = 'partner' AND prr.status = 'active'
  )
  SELECT
    v_budget_id IS NOT NULL,
    COALESCE(v_baseline_total, 0) + revision_totals.delta_total,
    cat.materials, cat.labor, cat.subcontractors, cat.other,
    v_rate,
    purch.forecast, purch.committed, purch.received,
    labor.cost, sub.cost,
    (purch.committed + purch.received + labor.cost + sub.cost),
    (COALESCE(v_baseline_total, 0) + revision_totals.delta_total) - (purch.committed + purch.received + labor.cost + sub.cost),
    (purch.committed + purch.received + labor.cost + sub.cost) + purch.forecast
  FROM revision_totals, cat, purch, labor, sub;
END;
$$;
