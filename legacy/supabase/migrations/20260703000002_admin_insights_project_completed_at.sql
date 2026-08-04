-- Admin insights, Phase 3: project completion timestamp.
-- Additive migration — one nullable column + one trigger, no changes to
-- existing columns or behavior. Enables period-accurate "projects finished
-- in [date range]" reporting on the admin dashboard, which previously had
-- no way to know *when* a project reached status = 'Afsluttet'.

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Sets completed_at when status transitions into 'Afsluttet', and clears it
-- if the project is reopened (status changes away from 'Afsluttet'). Leaves
-- completed_at untouched on updates that don't touch status.
CREATE OR REPLACE FUNCTION public.set_project_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'Afsluttet' AND (OLD.status IS DISTINCT FROM 'Afsluttet') THEN
        NEW.completed_at = now();
    ELSIF NEW.status <> 'Afsluttet' AND OLD.status = 'Afsluttet' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_completed_at ON public.projects;
CREATE TRIGGER projects_set_completed_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_project_completed_at();

-- Backfill: projects already sitting at 'Afsluttet' get their existing
-- updated_at as a best-effort completed_at (exact completion moment is not
-- recoverable retroactively — this only affects historical period reporting
-- for projects finished before this migration ran).
UPDATE public.projects
SET completed_at = updated_at
WHERE status = 'Afsluttet' AND completed_at IS NULL;
