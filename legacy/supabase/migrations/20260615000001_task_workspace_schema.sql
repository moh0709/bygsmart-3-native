-- ============================================================
-- MIGRATION: Task Workspace — Documentation, Check-ins,
--            Handovers & Partner-scoped RLS
--
-- Implements the "task-docs" private storage bucket (comment
-- block only — bucket must be created via Dashboard/API),
-- three new collaboration tables, new columns on tasks and
-- projects, and partner-scoped RLS extensions.
--
-- Prerequisites:
--   20260610000001_partner_collaboration.sql  (has_partner_task_access,
--     is_project_member, is_project_owner, get_user_project_role,
--     guard_partner_invite_update pattern)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. New columns on existing tables
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acceptance_report_path TEXT,
    ADD COLUMN IF NOT EXISTS handover_status       TEXT NOT NULL DEFAULT 'none'
        CHECK (handover_status IN ('none', 'draft', 'submitted', 'accepted', 'rejected'));

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS acceptance_report_settings JSONB;

-- ─────────────────────────────────────────────────────────────
-- 2. task_documentation
--    Stores work-evidence records (notes, photos, files, audio)
--    attached to a task. Files live in the "task-docs" bucket.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_documentation (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id   UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    author_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name  TEXT        NOT NULL DEFAULT '',
    kind         TEXT        NOT NULL DEFAULT 'text'
                             CHECK (kind IN ('text', 'photo', 'audio', 'link', 'file', 'report')),
    body         TEXT,
    storage_path TEXT,
    mime_type    TEXT,
    size_bytes   BIGINT,
    is_pinned    BOOLEAN     NOT NULL DEFAULT false,
    comments     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER task_documentation_updated_at
    BEFORE UPDATE ON public.task_documentation
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_task_documentation_task
    ON public.task_documentation(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_documentation_task_pinned
    ON public.task_documentation(task_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_documentation_author
    ON public.task_documentation(author_id);

-- ─────────────────────────────────────────────────────────────
-- 3. task_check_ins
--    GPS-stamped check-in / check-out per user per task.
--    Partial unique index enforces one open session per user.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_check_ins (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id       UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name        TEXT        NOT NULL DEFAULT '',
    checked_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_out_at   TIMESTAMPTZ,
    checkin_lat      NUMERIC(9,6),
    checkin_lng      NUMERIC(9,6),
    checkin_accuracy NUMERIC(10,2),
    auto_closed      BOOLEAN     NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open session (no check-out) per user at a time (across all tasks).
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_check_ins_one_active_per_user
    ON public.task_check_ins(user_id)
    WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_check_ins_task
    ON public.task_check_ins(task_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_check_ins_user
    ON public.task_check_ins(user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. task_handovers
--    Formal two-party acceptance workflow.
--    Trigger guard (§6) enforces state transitions.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_handovers (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                 UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id              UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    submitted_by            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    supplier_signature_path TEXT,
    status                  TEXT        NOT NULL DEFAULT 'submitted'
                                        CHECK (status IN ('submitted', 'accepted', 'rejected')),
    reviewed_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at             TIMESTAMPTZ,
    mester_signature_path   TEXT,
    rejection_reason        TEXT,
    snags                   JSONB,
    report_path             TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER task_handovers_updated_at
    BEFORE UPDATE ON public.task_handovers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_task_handovers_task
    ON public.task_handovers(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_handovers_submitted_by
    ON public.task_handovers(submitted_by);

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger guard: task_handovers INSERT + UPDATE transitions
--    Workers can only INSERT rows with status='submitted' and
--    no review fields set. Project owner / manager may UPDATE
--    rows to 'accepted' or 'rejected' and set review fields.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_task_handover_op()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT project_id INTO v_project_id FROM public.tasks WHERE id = NEW.task_id;

    -- Owners and managers are unrestricted on both INSERT and UPDATE.
    IF public.is_project_owner(v_project_id)
       OR public.get_user_project_role(v_project_id) = 'MANAGER'
    THEN
        RETURN NEW;
    END IF;

    -- Non-manager / worker path
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'submitted' THEN
            RAISE EXCEPTION 'Handover kan kun oprettes med status submitted'
                  USING ERRCODE = '23514';
        END IF;
        IF NEW.reviewed_by IS NOT NULL
           OR NEW.reviewed_at IS NOT NULL
           OR NEW.mester_signature_path IS NOT NULL
           OR NEW.rejection_reason IS NOT NULL
        THEN
            RAISE EXCEPTION 'Kun projektejer eller manager kan sætte reviewfelter'
                  USING ERRCODE = '42501';
        END IF;
    ELSE
        -- Workers may re-submit a previously rejected handover. This specific
        -- rejected → submitted transition (which also clears review fields) is
        -- the only status change a worker is permitted to make via UPDATE.
        IF OLD.status = 'rejected' AND NEW.status = 'submitted' THEN
            IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
               OR NEW.task_id IS DISTINCT FROM OLD.task_id
            THEN
                RAISE EXCEPTION 'Kun projektejeren eller manager kan ændre disse felter'
                      USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END IF;

        -- UPDATE: workers may not change task identity, status, or review fields.
        IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
           OR NEW.task_id   IS DISTINCT FROM OLD.task_id
        THEN
            RAISE EXCEPTION 'Kun projektejeren eller manager kan ændre disse felter'
                  USING ERRCODE = '42501';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Ugyldig statusændring på overdragelse'
                  USING ERRCODE = '23514';
        END IF;

        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
           OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
            RAISE EXCEPTION 'Kun projektejer eller manager kan sætte reviewfelter'
                  USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS task_handovers_guard_update ON public.task_handovers;
DROP TRIGGER IF EXISTS task_handovers_guard_op ON public.task_handovers;
DROP FUNCTION IF EXISTS public.guard_task_handover_update();

CREATE TRIGGER task_handovers_guard_op
    BEFORE INSERT OR UPDATE ON public.task_handovers
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_handover_op();

-- ─────────────────────────────────────────────────────────────
-- 5b. RLS helper: accepted-partner-only task access
--     Used by SELECT policies on workspace tables so that
--     invited/negotiating partners cannot read evidence or
--     handovers until the deal is settled (status='accepted').
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_accepted_partner_task_access(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.partner_task_access pta
        JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
        WHERE pta.task_id = p_task_id
          AND pp.partner_id = auth.uid()
          AND pp.status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.task_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_check_ins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_handovers     ENABLE ROW LEVEL SECURITY;

-- ── task_documentation ──────────────────────────────────────

DROP POLICY IF EXISTS "task_docs_select" ON public.task_documentation;
CREATE POLICY "task_docs_select" ON public.task_documentation
    FOR SELECT TO authenticated
    USING (
        public.is_project_member(project_id)
        OR public.has_accepted_partner_task_access(task_id)
    );

DROP POLICY IF EXISTS "task_docs_insert" ON public.task_documentation;
CREATE POLICY "task_docs_insert" ON public.task_documentation
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND (
            public.is_project_member(project_id)
            OR EXISTS (
                SELECT 1
                FROM public.partner_task_access pta
                JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
                WHERE pta.task_id = task_documentation.task_id
                  AND pp.partner_id = auth.uid()
                  AND pp.status = 'accepted'
            )
        )
    );

DROP POLICY IF EXISTS "task_docs_update_own" ON public.task_documentation;
CREATE POLICY "task_docs_update_own" ON public.task_documentation
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Project owner / manager may update the comments column on any doc in the
-- project (e.g. to add review comments). The application layer (addCommentToTaskDoc)
-- ensures only the `comments` JSONB column is changed, keeping authorship fields intact.
DROP POLICY IF EXISTS "task_docs_update_comments" ON public.task_documentation;
CREATE POLICY "task_docs_update_comments" ON public.task_documentation
    FOR UPDATE TO authenticated
    USING (
        public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    )
    WITH CHECK (
        public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

DROP POLICY IF EXISTS "task_docs_delete" ON public.task_documentation;
CREATE POLICY "task_docs_delete" ON public.task_documentation
    FOR DELETE TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

-- ── task_check_ins ───────────────────────────────────────────

DROP POLICY IF EXISTS "task_check_ins_select" ON public.task_check_ins;
CREATE POLICY "task_check_ins_select" ON public.task_check_ins
    FOR SELECT TO authenticated
    USING (
        public.is_project_member(project_id)
        OR public.has_accepted_partner_task_access(task_id)
    );

DROP POLICY IF EXISTS "task_check_ins_insert" ON public.task_check_ins;
CREATE POLICY "task_check_ins_insert" ON public.task_check_ins
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            public.is_project_member(project_id)
            OR EXISTS (
                SELECT 1
                FROM public.partner_task_access pta
                JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
                WHERE pta.task_id = task_check_ins.task_id
                  AND pp.partner_id = auth.uid()
                  AND pp.status = 'accepted'
            )
        )
    );

DROP POLICY IF EXISTS "task_check_ins_update_own" ON public.task_check_ins;
CREATE POLICY "task_check_ins_update_own" ON public.task_check_ins
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "task_check_ins_delete" ON public.task_check_ins;
CREATE POLICY "task_check_ins_delete" ON public.task_check_ins
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

-- ── task_handovers ───────────────────────────────────────────

DROP POLICY IF EXISTS "task_handovers_select" ON public.task_handovers;
CREATE POLICY "task_handovers_select" ON public.task_handovers
    FOR SELECT TO authenticated
    USING (
        public.is_project_member(project_id)
        OR public.has_accepted_partner_task_access(task_id)
    );

DROP POLICY IF EXISTS "task_handovers_insert" ON public.task_handovers;
CREATE POLICY "task_handovers_insert" ON public.task_handovers
    FOR INSERT TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND (
            public.is_project_member(project_id)
            OR EXISTS (
                SELECT 1
                FROM public.partner_task_access pta
                JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
                WHERE pta.task_id = task_handovers.task_id
                  AND pp.partner_id = auth.uid()
                  AND pp.status = 'accepted'
            )
        )
    );

DROP POLICY IF EXISTS "task_handovers_update" ON public.task_handovers;
CREATE POLICY "task_handovers_update" ON public.task_handovers
    FOR UPDATE TO authenticated
    USING (
        submitted_by = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

DROP POLICY IF EXISTS "task_handovers_delete" ON public.task_handovers;
CREATE POLICY "task_handovers_delete" ON public.task_handovers
    FOR DELETE TO authenticated
    USING (
        public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

-- ── time_entries: partner-scoped extensions ──────────────────

DROP POLICY IF EXISTS "time_entries_insert_partner" ON public.time_entries;
CREATE POLICY "time_entries_insert_partner" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND task_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.partner_task_access pta
            JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
            WHERE pta.task_id = time_entries.task_id
              AND pp.partner_id = auth.uid()
              AND pp.status = 'accepted'
        )
    );

DROP POLICY IF EXISTS "time_entries_select_partner" ON public.time_entries;
-- Partners may read all time entries on tasks they have accepted access to,
-- not only their own, so that task-total hour aggregations are accurate.
CREATE POLICY "time_entries_select_partner" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        task_id IS NOT NULL
        AND public.has_accepted_partner_task_access(task_id)
    );

-- ─────────────────────────────────────────────────────────────
-- 7. Realtime
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_documentation;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_check_ins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_handovers;

-- ─────────────────────────────────────────────────────────────
-- 8. Storage: task-docs bucket + object-level RLS
--    Private bucket; all access via signed URLs.
--    Path conventions (enforced by INSERT policy):
--      • {project_id}/{task_id}/{uuid}.ext  — task evidence
--      • signatures/{user_id}/{uuid}.png    — handover sigs
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-docs', 'task-docs', false, 52428800)   -- 50 MB per file
ON CONFLICT (id) DO NOTHING;

-- Safe path parsers: cast first/second segment to UUID without
-- raising when the path starts with the 'signatures' prefix.

CREATE OR REPLACE FUNCTION public.storage_taskdocs_project_member(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_seg1 TEXT;
    v_proj UUID;
BEGIN
    v_seg1 := split_part(object_name, '/', 1);
    IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN FALSE; END IF;
    BEGIN
        v_proj := v_seg1::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;
    RETURN public.is_project_member(v_proj);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.storage_taskdocs_accepted_partner(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_seg1    TEXT;
    v_seg2    TEXT;
    v_task_id UUID;
BEGIN
    v_seg1 := split_part(object_name, '/', 1);
    IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN FALSE; END IF;
    v_seg2 := split_part(object_name, '/', 2);
    IF v_seg2 = '' THEN RETURN FALSE; END IF;
    BEGIN
        v_task_id := v_seg2::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;
    RETURN public.has_accepted_partner_task_access(v_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- SELECT: download / generate signed URL
DROP POLICY IF EXISTS "task_docs_storage_select" ON storage.objects;
CREATE POLICY "task_docs_storage_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            -- Own signature file
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            -- Task evidence: project member or accepted partner
            OR public.storage_taskdocs_project_member(name)
            OR public.storage_taskdocs_accepted_partner(name)
        )
    );

-- INSERT: upload
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
        )
    );

-- UPDATE: replace / metadata (project members only, not partners)
DROP POLICY IF EXISTS "task_docs_storage_update" ON storage.objects;
CREATE POLICY "task_docs_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
        )
    );

-- DELETE: project members only
DROP POLICY IF EXISTS "task_docs_storage_delete" ON storage.objects;
CREATE POLICY "task_docs_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'task-docs'
        AND (
            (split_part(name, '/', 1) = 'signatures'
             AND split_part(name, '/', 2) = (auth.uid())::text)
            OR public.storage_taskdocs_project_member(name)
        )
    );

-- ─────────────────────────────────────────────────────────────
-- END OF MIGRATION
-- ─────────────────────────────────────────────────────────────
