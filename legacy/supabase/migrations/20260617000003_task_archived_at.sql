-- ============================================================
-- MIGRATION: T4 — Task lifecycle: archived_at column
-- Adds tasks.archived_at to support soft-archive / restore.
-- Project cancellation uses projects.status (free text) —
-- no schema change required for projects.
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_archived_at
  ON public.tasks(archived_at)
  WHERE archived_at IS NOT NULL;
