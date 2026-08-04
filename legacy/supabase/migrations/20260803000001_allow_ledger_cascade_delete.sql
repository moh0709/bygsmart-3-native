-- Fix: a project with a budget could never be deleted — and so neither could
-- its owner.
--
-- 20260704000002_project_budget_baseline_and_revisions.sql made the budget
-- ledger append-only with reject_ledger_mutation(), which raises on EVERY
-- delete. But the ledger hangs off projects by cascade:
--
--   DELETE projects
--     └─ project_budgets                          (ON DELETE CASCADE)
--         ├─ project_budget_categories            → rejected
--         └─ project_budget_revisions             → rejected
--             └─ project_budget_revision_categories → rejected
--
-- so the cascade aborted with 42501 'Denne tabel er append-only' and the whole
-- DELETE failed. Measured on production 2026-08-03: 40 of 55 projects had a
-- budget, and 15 owners (13 demo + 2 real) could not be deleted at all — which
-- also broke account deletion / GDPR erasure for those real users.
--
-- The guard's purpose is that history cannot be EDITED or cherry-picked, not
-- that a deliberately deleted project must live forever. So: still reject every
-- update and every ad-hoc delete, but allow a row to go when its own parent is
-- already gone, which is only true inside an ON DELETE CASCADE.
--
-- SECURITY DEFINER matters here. Without it the parent lookup runs under the
-- caller's RLS, so a caller who merely cannot SEE the parent would look like a
-- cascade and could delete ledger history. Definer rights make "is the parent
-- really gone?" an honest question. Ad-hoc deletes remain blocked by the
-- ledger tables' own RLS (they have no DELETE policy) as well as by this
-- trigger.

CREATE OR REPLACE FUNCTION public.reject_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_gone BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'project_budget_revision_categories' THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.project_budget_revisions WHERE id = OLD.revision_id
      ) INTO parent_gone;
    ELSE
      -- project_budget_categories and project_budget_revisions both hang off
      -- project_budgets via project_budget_id.
      SELECT NOT EXISTS (
        SELECT 1 FROM public.project_budgets WHERE id = OLD.project_budget_id
      ) INTO parent_gone;
    END IF;

    IF parent_gone THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'Denne tabel er append-only' USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.reject_ledger_mutation() IS
  'Budget ledger guard: rejects all updates and ad-hoc deletes, but lets a row '
  'be removed when its parent budget/revision is already gone (ON DELETE CASCADE '
  'from projects). SECURITY DEFINER so the parent check is not blinded by RLS.';
