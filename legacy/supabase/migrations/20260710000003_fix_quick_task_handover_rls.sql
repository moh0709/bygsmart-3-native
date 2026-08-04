-- ============================================================
-- MIGRATION: fix quick-task handover approval bug.
--
-- task_handovers_update only allowed the submitter, a project
-- OWNER, or a project MANAGER to accept/reject a handover
-- (project_id branches). A quick task has project_id = NULL by
-- definition, so its owner — who is NOT the submitter — had no
-- RLS path to Godkend/Afvis a handover submitted by someone else.
-- This is a real pre-existing gap, not just a UI omission: the
-- GodkendModal/AfvisModal UI gate in TaskDetailPage additionally
-- only rendered when task.projectId was truthy, compounding it.
--
-- Fix: replace the project-specific branches with
-- get_effective_task_role(task_id) IN ('owner','responsible'),
-- which already correctly resolves for BOTH project tasks
-- (project OWNER/MANAGER) and quick tasks (tasks.owner_id, or an
-- explicit quick_task_access role grant) — see
-- 20260710000002_task_access_project_task_rls.sql.
-- ============================================================

DROP POLICY IF EXISTS "task_handovers_update" ON public.task_handovers;
CREATE POLICY "task_handovers_update" ON public.task_handovers
    FOR UPDATE TO authenticated
    USING (
        submitted_by = auth.uid()
        OR public.get_effective_task_role(task_id) IN ('owner', 'responsible')
    );
