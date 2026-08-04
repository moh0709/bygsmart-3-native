-- Phase 4: Member termination audit log
-- Additive migration — adds one new table, no changes to existing ones.
--
-- One row is written (via the service role from
-- POST /api/project/terminate-member) each time a project owner terminates a
-- collaboration. The row records who was removed, who removed them, the storage
-- path of the generated handover report (OVERDRAGELSESRAPPORT), and the email
-- delivery outcome. Writes are service-role only; owners (and admins) may read
-- their own termination history.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. member_terminations — one row per terminated collaboration
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_terminations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    removed_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    removed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Storage path of the generated handover report (nullable — generation or
    -- upload may fail without blocking the revocation).
    report_path     text,
    email_status    text CHECK (email_status IN ('sent', 'failed', 'skipped')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_terminations_project_created
    ON public.member_terminations(project_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — service-role-only writes; the remover (and admins) may read
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.member_terminations ENABLE ROW LEVEL SECURITY;

-- The current project owner, or any admin, may read the audit row. Authorization
-- is anchored to the authoritative projects.owner_id relationship (not removed_by,
-- which only happens to match the owner for today's endpoint). No
-- INSERT/UPDATE/DELETE policies are created, so writes are only possible via the
-- service role (the API server).
CREATE POLICY "member_terminations_owner_select" ON public.member_terminations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects pr
            WHERE pr.id = member_terminations.project_id
              AND pr.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. revoke_project_member_access — atomic access revocation in one transaction
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes every access vector a terminated member holds on a project in a single
-- transaction, so the database can never be left in a partial state (e.g.
-- project_resources deleted while quick_task_access or task assignments remain).
-- Runs as the function owner (service role context) to bypass RLS; the API server
-- has already verified the caller is the project owner before invoking this.
--
-- In order: resolve the resource row, delete its resource_task_access, delete the
-- project_resources row (which re-syncs projects.team via trigger), delete
-- quick_task_access for the project's tasks, and strip the user from
-- tasks.assignees. Any failure rolls the whole function back.
CREATE OR REPLACE FUNCTION public.revoke_project_member_access(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
DECLARE
    v_resource_id UUID;
BEGIN
    -- a. Resolve the resource row for this (project, user) pair.
    SELECT id INTO v_resource_id
    FROM public.project_resources
    WHERE project_id = p_project_id
      AND user_id = p_user_id;

    IF v_resource_id IS NOT NULL THEN
        -- b. resource_task_access for this resource.
        DELETE FROM public.resource_task_access
        WHERE resource_id = v_resource_id;

        -- c. project_resources — triggers sync_projects_team_mirror() which
        --    rebuilds projects.team automatically.
        DELETE FROM public.project_resources
        WHERE id = v_resource_id;
    END IF;

    -- d. quick_task_access — scoped to this project's tasks.
    DELETE FROM public.quick_task_access
    WHERE user_id = p_user_id
      AND task_id IN (
          SELECT id FROM public.tasks WHERE project_id = p_project_id
      );

    -- e. Remove the member from tasks.assignees JSONB.
    UPDATE public.tasks
    SET assignees = COALESCE((
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(assignees) AS elem
        WHERE elem->>'id' <> p_user_id::text
    ), '[]'::jsonb)
    WHERE project_id = p_project_id
      AND assignees @> jsonb_build_array(jsonb_build_object('id', p_user_id::text));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Execution is restricted to the service role; the API server is the only caller
-- and it gates access by verifying projects.owner_id before invoking.
REVOKE ALL ON FUNCTION public.revoke_project_member_access(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_project_member_access(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_project_member_access(UUID, UUID) TO service_role;
