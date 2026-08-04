-- ─────────────────────────────────────────────────────────────────────────────
-- Project Budget: baseline + append-only revisions + per-task labor rates.
--
-- Replaces the dead-end `projects.budget JSONB {total, used}` (set once in the
-- wizard, never editable, `used` never recomputed) with a real budget entity:
--   - project_budgets: one approved baseline per project, split into 4
--     categories, plus a default labor rate. Baseline fields are frozen once
--     approved (protect_project_budget_baseline trigger) — later changes go
--     through create_project_budget_revision(), never a direct UPDATE.
--   - project_budget_categories: the baseline's category breakdown.
--   - project_budget_revisions / project_budget_revision_categories: an
--     append-only change log (no UPDATE/DELETE policy + a rejecting trigger,
--     same defense-in-depth pattern as 20260703000007's column guards).
--   - task_budget_rates: optional per-task hourly-rate override, owner/manager
--     only. Kept as its own table (not a column on `tasks`) because `tasks`
--     rows are readable by any project member per the existing
--     tasks_select_project_member/tasks_select_resource_access policies —
--     RLS is row-level, so a money-sensitive column on that table would be
--     visible to far more people than can_view_project_budget() intends.
--
-- get_project_budget_summary() is the single source of truth for "actual
-- spend" (purchases by status, labor = hours × task-or-project rate,
-- subcontractor settlement from project_resources.agreed_price_ore). Every
-- write RPC also mirrors the current planned total into projects.budget so
-- existing readers (projectIntelligence.ts, ProjectDetailsTabContent.tsx,
-- pdfReport.ts, ProjectReportTemplate.tsx) keep working unchanged until they
-- are migrated onto the richer summary in a later phase.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_budgets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  status                   text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'approved')),
  total_kr                 numeric(14,2) NOT NULL DEFAULT 0,
  labor_rate_dkk_per_hour  numeric(10,2),
  currency                 text NOT NULL DEFAULT 'DKK',
  created_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_budget_categories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_budget_id uuid NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  category          text NOT NULL CHECK (category IN ('materials', 'labor', 'subcontractors', 'other')),
  amount_kr         numeric(14,2) NOT NULL DEFAULT 0,
  note              text,
  UNIQUE (project_budget_id, category)
);

CREATE TABLE IF NOT EXISTS public.project_budget_revisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_budget_id uuid NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  revision_number   integer NOT NULL,
  reason            text NOT NULL CHECK (length(trim(reason)) > 0),
  total_delta_kr    numeric(14,2) NOT NULL,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_budget_id, revision_number)
);

CREATE TABLE IF NOT EXISTS public.project_budget_revision_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.project_budget_revisions(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('materials', 'labor', 'subcontractors', 'other')),
  delta_kr    numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (revision_id, category)
);

CREATE TABLE IF NOT EXISTS public.task_budget_rates (
  task_id         uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hourly_rate_dkk numeric(10,2) NOT NULL,
  updated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON public.project_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_categories_budget ON public.project_budget_categories(project_budget_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_revisions_budget ON public.project_budget_revisions(project_budget_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_project_budget_revision_categories_revision ON public.project_budget_revision_categories(revision_id);
CREATE INDEX IF NOT EXISTS idx_task_budget_rates_project ON public.task_budget_rates(project_id);

-- ── Immutability guards ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_project_budget_baseline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    NEW.total_kr := OLD.total_kr;
    NEW.status   := OLD.status;
    NEW.currency := OLD.currency;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_budgets_protect_baseline ON public.project_budgets;
CREATE TRIGGER project_budgets_protect_baseline
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.protect_project_budget_baseline();

CREATE OR REPLACE FUNCTION public.reject_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Denne tabel er append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS project_budget_categories_immutable ON public.project_budget_categories;
CREATE TRIGGER project_budget_categories_immutable
  BEFORE UPDATE OR DELETE ON public.project_budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS project_budget_revisions_immutable ON public.project_budget_revisions;
CREATE TRIGGER project_budget_revisions_immutable
  BEFORE UPDATE OR DELETE ON public.project_budget_revisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

DROP TRIGGER IF EXISTS project_budget_revision_categories_immutable ON public.project_budget_revision_categories;
CREATE TRIGGER project_budget_revision_categories_immutable
  BEFORE UPDATE OR DELETE ON public.project_budget_revision_categories
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Reads gated by the existing can_view_project_budget() (owner, MANAGER, or a
-- project_resources row with visibility='all'), same rule already governing
-- projects.budget. No INSERT/UPDATE/DELETE policies are defined for
-- authenticated on any of these 5 tables — all writes go exclusively through
-- the SECURITY DEFINER RPCs below (which, executing as the table owner, are
-- unaffected by RLS), so a direct PostgREST write from the browser is denied
-- by default regardless of role.

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_revision_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_budget_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_budgets_select" ON public.project_budgets;
CREATE POLICY "project_budgets_select" ON public.project_budgets
  FOR SELECT TO authenticated USING (public.can_view_project_budget(project_id));

DROP POLICY IF EXISTS "project_budget_categories_select" ON public.project_budget_categories;
CREATE POLICY "project_budget_categories_select" ON public.project_budget_categories
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.project_budgets pb
      WHERE pb.id = project_budget_id AND public.can_view_project_budget(pb.project_id)
    )
  );

DROP POLICY IF EXISTS "project_budget_revisions_select" ON public.project_budget_revisions;
CREATE POLICY "project_budget_revisions_select" ON public.project_budget_revisions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.project_budgets pb
      WHERE pb.id = project_budget_id AND public.can_view_project_budget(pb.project_id)
    )
  );

DROP POLICY IF EXISTS "project_budget_revision_categories_select" ON public.project_budget_revision_categories;
CREATE POLICY "project_budget_revision_categories_select" ON public.project_budget_revision_categories
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.project_budget_revisions r
      JOIN public.project_budgets pb ON pb.id = r.project_budget_id
      WHERE r.id = revision_id AND public.can_view_project_budget(pb.project_id)
    )
  );

DROP POLICY IF EXISTS "task_budget_rates_select" ON public.task_budget_rates;
CREATE POLICY "task_budget_rates_select" ON public.task_budget_rates
  FOR SELECT TO authenticated USING (public.can_view_project_budget(project_id));

-- ── RPCs ─────────────────────────────────────────────────────────────────────

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

  SELECT id, total_kr, labor_rate_dkk_per_hour INTO v_budget_id, v_baseline_total, v_rate
  FROM public.project_budgets WHERE project_id = p_project_id;

  RETURN QUERY
  WITH revision_totals AS (
    SELECT COALESCE(SUM(total_delta_kr), 0) AS delta_total
    FROM public.project_budget_revisions WHERE project_budget_id = v_budget_id
  ),
  cat AS (
    SELECT
      COALESCE((SELECT SUM(amount_kr) FROM public.project_budget_categories WHERE project_budget_id = v_budget_id AND category = 'materials'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'materials'), 0) AS materials,
      COALESCE((SELECT SUM(amount_kr) FROM public.project_budget_categories WHERE project_budget_id = v_budget_id AND category = 'labor'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'labor'), 0) AS labor,
      COALESCE((SELECT SUM(amount_kr) FROM public.project_budget_categories WHERE project_budget_id = v_budget_id AND category = 'subcontractors'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'subcontractors'), 0) AS subcontractors,
      COALESCE((SELECT SUM(amount_kr) FROM public.project_budget_categories WHERE project_budget_id = v_budget_id AND category = 'other'), 0)
        + COALESCE((SELECT SUM(rc.delta_kr) FROM public.project_budget_revision_categories rc JOIN public.project_budget_revisions r ON r.id = rc.revision_id WHERE r.project_budget_id = v_budget_id AND rc.category = 'other'), 0) AS other
  ),
  purch AS (
    SELECT
      COALESCE(SUM(price * quantity) FILTER (WHERE status = 'Afventer'), 0) AS forecast,
      COALESCE(SUM(price * quantity) FILTER (WHERE status = 'Bestilt'),  0) AS committed,
      COALESCE(SUM(price * quantity) FILTER (WHERE status = 'Modtaget'), 0) AS received
    FROM public.purchases WHERE project_id = p_project_id
  ),
  labor AS (
    SELECT COALESCE(SUM(te.hours * COALESCE(tbr.hourly_rate_dkk, v_rate, 0)), 0) AS cost
    FROM public.time_entries te
    LEFT JOIN public.task_budget_rates tbr ON tbr.task_id = te.task_id
    WHERE te.project_id = p_project_id
  ),
  sub AS (
    SELECT COALESCE(SUM(agreed_price_ore), 0) / 100.0 AS cost
    FROM public.project_resources
    WHERE project_id = p_project_id AND kind = 'partner' AND status = 'active'
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

GRANT EXECUTE ON FUNCTION public.get_project_budget_summary(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_budget_baseline(
  p_project_id UUID,
  p_categories JSONB,
  p_labor_rate_dkk NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_budget_id UUID;
  v_total NUMERIC;
BEGIN
  IF NOT (public.is_project_owner(p_project_id) OR public.get_user_project_role(p_project_id) = 'MANAGER') THEN
    RAISE EXCEPTION 'Kun projektejer eller manager kan oprette budget' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_budgets WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Projektet har allerede et budget' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(SUM((c->>'amount_kr')::numeric), 0) INTO v_total
  FROM jsonb_array_elements(p_categories) c;

  INSERT INTO public.project_budgets (project_id, status, total_kr, labor_rate_dkk_per_hour, created_by, approved_by, approved_at)
  VALUES (p_project_id, 'approved', v_total, p_labor_rate_dkk, auth.uid(), auth.uid(), now())
  RETURNING id INTO v_budget_id;

  INSERT INTO public.project_budget_categories (project_budget_id, category, amount_kr, note)
  SELECT v_budget_id, c->>'category', COALESCE((c->>'amount_kr')::numeric, 0), c->>'note'
  FROM jsonb_array_elements(p_categories) c;

  UPDATE public.projects SET budget = jsonb_build_object('total', v_total, 'used', 0) WHERE id = p_project_id;

  RETURN v_budget_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_budget_baseline(UUID, JSONB, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_budget_revision(
  p_project_id UUID,
  p_reason TEXT,
  p_category_deltas JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_budget_id UUID;
  v_baseline_total NUMERIC;
  v_prior_delta_total NUMERIC;
  v_delta_total NUMERIC;
  v_next_number INT;
  v_revision_id UUID;
BEGIN
  IF NOT (public.is_project_owner(p_project_id) OR public.get_user_project_role(p_project_id) = 'MANAGER') THEN
    RAISE EXCEPTION 'Kun projektejer eller manager kan ændre budgettet' USING ERRCODE = '42501';
  END IF;
  IF trim(coalesce(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Årsag er påkrævet' USING ERRCODE = '22000';
  END IF;

  SELECT id, total_kr INTO v_budget_id, v_baseline_total
  FROM public.project_budgets WHERE project_id = p_project_id;
  IF v_budget_id IS NULL THEN
    RAISE EXCEPTION 'Projektet har intet budget endnu' USING ERRCODE = '02000';
  END IF;

  SELECT COALESCE(SUM(total_delta_kr), 0) INTO v_prior_delta_total
  FROM public.project_budget_revisions WHERE project_budget_id = v_budget_id;

  SELECT COALESCE(SUM((d->>'delta_kr')::numeric), 0) INTO v_delta_total
  FROM jsonb_array_elements(p_category_deltas) d;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_next_number
  FROM public.project_budget_revisions WHERE project_budget_id = v_budget_id;

  INSERT INTO public.project_budget_revisions (project_budget_id, revision_number, reason, total_delta_kr, created_by)
  VALUES (v_budget_id, v_next_number, p_reason, v_delta_total, auth.uid())
  RETURNING id INTO v_revision_id;

  INSERT INTO public.project_budget_revision_categories (revision_id, category, delta_kr)
  SELECT v_revision_id, d->>'category', COALESCE((d->>'delta_kr')::numeric, 0)
  FROM jsonb_array_elements(p_category_deltas) d;

  UPDATE public.projects
  SET budget = jsonb_build_object('total', v_baseline_total + v_prior_delta_total + v_delta_total, 'used', 0)
  WHERE id = p_project_id;

  RETURN v_revision_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_budget_revision(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_project_labor_rate(p_project_id UUID, p_rate_dkk NUMERIC)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_project_owner(p_project_id) OR public.get_user_project_role(p_project_id) = 'MANAGER') THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  UPDATE public.project_budgets
  SET labor_rate_dkk_per_hour = p_rate_dkk, updated_at = now()
  WHERE project_id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projektet har intet budget endnu' USING ERRCODE = '02000';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project_labor_rate(UUID, NUMERIC) TO authenticated;

-- p_rate_dkk = NULL clears the override (task falls back to the project's
-- default rate again).
CREATE OR REPLACE FUNCTION public.update_task_hourly_rate(p_task_id UUID, p_rate_dkk NUMERIC)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id INTO v_project_id FROM public.tasks WHERE id = p_task_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Opgave ikke fundet eller ikke tilknyttet et projekt' USING ERRCODE = '02000';
  END IF;
  IF NOT (public.is_project_owner(v_project_id) OR public.get_user_project_role(v_project_id) = 'MANAGER') THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  IF p_rate_dkk IS NULL THEN
    DELETE FROM public.task_budget_rates WHERE task_id = p_task_id;
    RETURN;
  END IF;

  INSERT INTO public.task_budget_rates (task_id, project_id, hourly_rate_dkk, updated_by, updated_at)
  VALUES (p_task_id, v_project_id, p_rate_dkk, auth.uid(), now())
  ON CONFLICT (task_id) DO UPDATE
    SET hourly_rate_dkk = EXCLUDED.hourly_rate_dkk, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_task_hourly_rate(UUID, NUMERIC) TO authenticated;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Existing projects that already have a flat budget.total get a baseline row
-- so they show up in the new Budget tab instead of hitting the empty state.
-- The historical category split is unknown, so it's parked under "other" with
-- an explanatory note rather than guessed.

INSERT INTO public.project_budgets (project_id, status, total_kr, created_by, approved_by, approved_at, created_at)
SELECT p.id, 'approved', (p.budget->>'total')::numeric, p.owner_id, p.owner_id, p.created_at, p.created_at
FROM public.projects p
WHERE p.budget IS NOT NULL
  AND (p.budget->>'total') IS NOT NULL
  AND (p.budget->>'total')::numeric > 0
  AND NOT EXISTS (SELECT 1 FROM public.project_budgets pb WHERE pb.project_id = p.id);

INSERT INTO public.project_budget_categories (project_budget_id, category, amount_kr, note)
SELECT pb.id, 'other', pb.total_kr, 'Migreret fra tidligere flad budgetværdi — ukendt kategorifordeling'
FROM public.project_budgets pb
WHERE NOT EXISTS (SELECT 1 FROM public.project_budget_categories c WHERE c.project_budget_id = pb.id);
