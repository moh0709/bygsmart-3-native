-- ============================================================
-- MIGRATION: org storage isolation + usage metering (Phase 6 of
-- the BYG 3.0 modular monolith).
--
-- 1. NEW WRITES get org-prefixed paths in the existing private
--    task-docs bucket (plan decision D9 — no new bucket, no object
--    moves; legacy paths stay readable forever via dual-read):
--      org/{org_id}/project/{project_id}/task/{task_id}/{uuid}.ext
--      org/{org_id}/project/{project_id}/documents/{uuid}.ext
--      org/{org_id}/project/{project_id}/reports/{...}.pdf
--    quick-tasks/… and signatures/… keep their existing shapes.
--    Two SECURITY DEFINER path parsers are OR-ed into the four
--    task_docs_storage_* policies (recreated with their CURRENT
--    live conditions — additive, nothing removed).
--
-- 2. METERING: org_storage_usage refreshed nightly by pg_cron
--    (02:15). Legacy paths attribute via joins (project → org,
--    quick task → owner's org, signature → user's org,
--    negotiation → invite → project → org). Soft enforcement only
--    (the client warns at 80/100% — uploads are never blocked).
--
-- 3. SECURITY CLEANUP: the 'project-files' bucket was PUBLIC with
--    dev policies granting anon read/write/update/delete. It has
--    0 objects and no code references — policies dropped, bucket
--    deleted (clears the advisor's public-bucket finding).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1a. Org-path parsers
-- ─────────────────────────────────────────────────────────────

-- org/{org_id}/project/{project_id}/… — project members (any sub-kind).
CREATE OR REPLACE FUNCTION public.storage_org_project_member(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
BEGIN
    IF split_part(object_name, '/', 1) <> 'org'
       OR split_part(object_name, '/', 3) <> 'project' THEN
        RETURN FALSE;
    END IF;
    BEGIN
        v_project_id := split_part(object_name, '/', 4)::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;
    RETURN public.is_project_member(v_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- org/{org_id}/project/{project_id}/task/{task_id}/… — accepted partners
-- may read/write task evidence (mirrors storage_taskdocs_accepted_partner).
CREATE OR REPLACE FUNCTION public.storage_org_partner_task(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_task_id UUID;
BEGIN
    IF split_part(object_name, '/', 1) <> 'org'
       OR split_part(object_name, '/', 5) <> 'task' THEN
        RETURN FALSE;
    END IF;
    BEGIN
        v_task_id := split_part(object_name, '/', 6)::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;
    RETURN public.has_accepted_partner_task_access(v_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION public.storage_org_project_member(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_org_partner_task(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_org_project_member(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_org_partner_task(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 1b. Recreate the four policies = CURRENT live conditions + org paths
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "task_docs_storage_select" ON storage.objects;
CREATE POLICY "task_docs_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_accepted_partner(name)
            OR public.storage_taskdocs_quick_task(name)
            OR public.storage_org_project_member(name)
            OR public.storage_org_partner_task(name)
        )
    );

DROP POLICY IF EXISTS "task_docs_storage_insert" ON storage.objects;
CREATE POLICY "task_docs_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_accepted_partner(name)
            OR public.storage_taskdocs_quick_task(name)
            OR public.storage_org_project_member(name)
            OR public.storage_org_partner_task(name)
        )
    );

DROP POLICY IF EXISTS "task_docs_storage_update" ON storage.objects;
CREATE POLICY "task_docs_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_org_project_member(name)
        )
    );

DROP POLICY IF EXISTS "task_docs_storage_delete" ON storage.objects;
CREATE POLICY "task_docs_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_quick_task(name)
            OR public.storage_org_project_member(name)
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 2. Usage metering
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_storage_usage (
    org_id       uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    bytes_total  bigint NOT NULL DEFAULT 0,
    bytes_legacy bigint NOT NULL DEFAULT 0,
    object_count integer NOT NULL DEFAULT 0,
    computed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_storage_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_storage_usage_select_member" ON public.org_storage_usage;
CREATE POLICY "org_storage_usage_select_member" ON public.org_storage_usage
    FOR SELECT TO authenticated
    USING (public.is_org_member(org_id));

-- Full rebuild each run — tiny data volumes, and a rebuild can never drift.
CREATE OR REPLACE FUNCTION public.refresh_org_storage_usage()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.org_storage_usage;

    INSERT INTO public.org_storage_usage (org_id, bytes_total, bytes_legacy, object_count, computed_at)
    SELECT
        attributed.org_id,
        SUM(attributed.bytes),
        SUM(attributed.bytes) FILTER (WHERE attributed.legacy),
        COUNT(*),
        now()
    FROM (
        SELECT
            CASE
                -- org-prefixed new paths: org/{org_id}/…
                WHEN split_part(so.name, '/', 1) = 'org'
                     AND split_part(so.name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(so.name, '/', 2)::uuid
                -- legacy task evidence: {project_id}/{task_id}/…
                WHEN split_part(so.name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (SELECT p.org_id FROM public.projects p
                          WHERE p.id = split_part(so.name, '/', 1)::uuid)
                -- quick tasks → task owner's org
                WHEN split_part(so.name, '/', 1) = 'quick-tasks'
                     AND split_part(so.name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (SELECT pr.active_org_id FROM public.tasks t
                          JOIN public.profiles pr ON pr.id = t.owner_id
                          WHERE t.id = split_part(so.name, '/', 2)::uuid)
                -- signatures → the signing user's org
                WHEN split_part(so.name, '/', 1) = 'signatures'
                     AND split_part(so.name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (SELECT pr.active_org_id FROM public.profiles pr
                          WHERE pr.id = split_part(so.name, '/', 2)::uuid)
                -- negotiation attachments → invite → project → org
                WHEN split_part(so.name, '/', 1) IN ('negotiation', 'negotiations')
                     AND split_part(so.name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (SELECT p.org_id FROM public.project_partners pp
                          JOIN public.projects p ON p.id = pp.project_id
                          WHERE pp.id = split_part(so.name, '/', 2)::uuid)
                -- legacy termination reports: handover-reports/{project_id}/…
                WHEN split_part(so.name, '/', 1) = 'handover-reports'
                     AND split_part(so.name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN (SELECT p.org_id FROM public.projects p
                          WHERE p.id = split_part(so.name, '/', 2)::uuid)
                ELSE NULL
            END AS org_id,
            COALESCE((so.metadata->>'size')::bigint, 0) AS bytes,
            split_part(so.name, '/', 1) <> 'org' AS legacy
        FROM storage.objects so
        WHERE so.bucket_id = 'task-docs'
    ) attributed
    WHERE attributed.org_id IS NOT NULL
    GROUP BY attributed.org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_org_storage_usage() FROM PUBLIC, anon, authenticated;

-- Nightly at 02:15 (idempotent: cron.schedule with a jobname upserts).
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('org-storage-usage', '15 2 * * *', $$SELECT public.refresh_org_storage_usage()$$);

-- Seed the table now so the client has data before the first nightly run.
SELECT public.refresh_org_storage_usage();

-- ─────────────────────────────────────────────────────────────
-- 3. Security cleanup: remove the public dev bucket
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "dev_public_read_project_files" ON storage.objects;
DROP POLICY IF EXISTS "dev_public_write_project_files" ON storage.objects;
DROP POLICY IF EXISTS "dev_public_update_project_files" ON storage.objects;
DROP POLICY IF EXISTS "dev_public_delete_project_files" ON storage.objects;
DROP POLICY IF EXISTS "project_files_all_access" ON storage.objects;
-- storage.protect_delete() forbids SQL bucket deletion — the bucket is made
-- private here (no policies remain, so nothing can reach it) and the actual
-- deletion runs via the Storage API in the Phase 6 rollout script.
UPDATE storage.buckets SET public = false WHERE id = 'project-files';
