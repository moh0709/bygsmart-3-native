-- ============================================================
-- MIGRATION: Task KS (kvalitetssikring) & Task Chat
--
-- Adds two collaboration tables to the task workspace:
--   • task_quality_controls — one row per KS control, incl.
--     deviation tracking and signature (files in "task-docs")
--   • task_chat_messages    — one row per task chat message
--
-- No new storage bucket or storage policies: deviation photos,
-- signatures and chat attachments reuse the existing private
-- "task-docs" bucket and its object-level policies
--   • {project_id}/{task_id}/{uuid}.ext  — evidence/attachments
--   • signatures/{user_id}/{uuid}.png    — signatures
--
-- Prerequisites:
--   20260610000001_partner_collaboration.sql  (is_project_member,
--     is_project_owner, get_user_project_role)
--   20260615000001_task_workspace_schema.sql  (handle_updated_at
--     usage, has_accepted_partner_task_access, task-docs bucket,
--     partner_task_access / project_partners accepted-join)
--   20260617000001_unified_resource_model.sql (project_resources,
--     resource_task_access — canonical partner access model)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. task_quality_controls
--    One row per KS control performed on a task. Deviation
--    photos are jsonb [{ storagePath, mimeType, sizeBytes }]
--    pointing into the "task-docs" bucket; signature_path is a
--    path in the same bucket (e.g. signatures/{user_id}/...).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_quality_controls (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id               UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id            UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    author_id             UUID        NOT NULL REFERENCES public.profiles(id),
    author_name           TEXT        NOT NULL DEFAULT '',
    control_point         TEXT,
    control_type          TEXT        CHECK (control_type IN ('visuel', 'maaling', 'dokumentation')),
    requirement_ref       TEXT,
    result                TEXT        CHECK (result IN ('godkendt', 'ikke_godkendt')),
    comments              TEXT,
    has_deviation         BOOLEAN     NOT NULL DEFAULT false,
    deviation_description TEXT,
    deviation_photos      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    corrective_action     TEXT,
    deviation_deadline    DATE,
    responsible_id        UUID        REFERENCES public.profiles(id),
    responsible_name      TEXT,
    signature_path        TEXT,
    control_date          DATE        NOT NULL DEFAULT now(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER task_quality_controls_updated_at
    BEFORE UPDATE ON public.task_quality_controls
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_task_quality_controls_task
    ON public.task_quality_controls(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_quality_controls_author
    ON public.task_quality_controls(author_id);

-- ─────────────────────────────────────────────────────────────
-- 2. task_chat_messages
--    One row per chat message on a task. mentions is a jsonb
--    array of mentioned user id strings; attachments live in
--    the "task-docs" bucket.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_chat_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id      UUID        REFERENCES public.projects(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES public.profiles(id),
    sender_name     TEXT        NOT NULL DEFAULT '',
    body            TEXT,
    attachment_path TEXT,
    attachment_mime TEXT,
    mentions        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_chat_messages_task
    ON public.task_chat_messages(task_id, created_at);

CREATE INDEX IF NOT EXISTS idx_task_chat_messages_sender
    ON public.task_chat_messages(sender_id);

-- project_id is redundant for efficient filtering, but may never be supplied
-- independently from the referenced task. IS NOT DISTINCT FROM covers NULL
-- project ids on standalone tasks.
CREATE OR REPLACE FUNCTION public.enforce_task_chat_project()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = NEW.task_id
          AND t.project_id IS NOT DISTINCT FROM NEW.project_id
    ) THEN
        RAISE EXCEPTION 'task_chat_messages project_id must match tasks.project_id';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS task_chat_project_guard ON public.task_chat_messages;
CREATE TRIGGER task_chat_project_guard
    BEFORE INSERT OR UPDATE OF task_id, project_id ON public.task_chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.enforce_task_chat_project();

CREATE TABLE IF NOT EXISTS public.task_chat_reads (
    task_id      UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_chat_reads_user
    ON public.task_chat_reads(user_id, task_id);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS helper: accepted-partner task access (canonical model)
--    20260617000001_unified_resource_model.sql made
--    project_resources / resource_task_access the canonical
--    partner access tables; partners accepted since then have no
--    matching partner_task_access / project_partners rows. Redefine
--    the helper to check the canonical model first, keeping the
--    legacy join for partners accepted before that migration.
--    Existing policies that call this helper (task_documentation,
--    task_check_ins, task_handovers, quick task tables) pick up
--    the new definition automatically.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_accepted_partner_task_access(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.resource_task_access rta
        JOIN public.project_resources pr ON pr.id = rta.resource_id
        WHERE rta.task_id = p_task_id
          AND pr.user_id  = auth.uid()
          AND pr.kind     = 'partner'
          AND pr.status   = 'active'
    )
    OR EXISTS (
        SELECT 1
        FROM public.partner_task_access pta
        JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
        WHERE pta.task_id = p_task_id
          AND pp.partner_id = auth.uid()
          AND pp.status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Authorize using the task's actual project, never the message payload alone.
CREATE OR REPLACE FUNCTION public.can_access_task_chat(p_task_id UUID, p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = p_task_id
          AND t.project_id IS NOT DISTINCT FROM p_project_id
          AND (
              (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
              OR public.has_accepted_partner_task_access(t.id)
              OR public.is_quick_task_accessible(t.id)
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_access_task_chat(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS (mirrors task_documentation policies)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.task_quality_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_chat_reads       ENABLE ROW LEVEL SECURITY;

-- ── task_quality_controls ────────────────────────────────────

DROP POLICY IF EXISTS "task_qc_select" ON public.task_quality_controls;
CREATE POLICY "task_qc_select" ON public.task_quality_controls
    FOR SELECT TO authenticated
    USING (
        public.is_project_member(project_id)
        OR public.has_accepted_partner_task_access(task_id)
    );

DROP POLICY IF EXISTS "task_qc_insert" ON public.task_quality_controls;
CREATE POLICY "task_qc_insert" ON public.task_quality_controls
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND (
            public.is_project_member(project_id)
            OR public.has_accepted_partner_task_access(task_id)
        )
    );

DROP POLICY IF EXISTS "task_qc_update" ON public.task_quality_controls;
CREATE POLICY "task_qc_update" ON public.task_quality_controls
    FOR UPDATE TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    )
    WITH CHECK (
        author_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

DROP POLICY IF EXISTS "task_qc_delete" ON public.task_quality_controls;
CREATE POLICY "task_qc_delete" ON public.task_quality_controls
    FOR DELETE TO authenticated
    USING (
        author_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

-- ── task_chat_messages ───────────────────────────────────────

DROP POLICY IF EXISTS "task_chat_select" ON public.task_chat_messages;
CREATE POLICY "task_chat_select" ON public.task_chat_messages
    FOR SELECT TO authenticated
    USING (
        public.can_access_task_chat(task_id, project_id)
    );

DROP POLICY IF EXISTS "task_chat_insert" ON public.task_chat_messages;
CREATE POLICY "task_chat_insert" ON public.task_chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.can_access_task_chat(task_id, project_id)
    );

DROP POLICY IF EXISTS "task_chat_update_own" ON public.task_chat_messages;
CREATE POLICY "task_chat_update_own" ON public.task_chat_messages
    FOR UPDATE TO authenticated
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());

-- Sender may delete their own messages; owner/manager may delete
-- any message in the project for moderation.
DROP POLICY IF EXISTS "task_chat_delete" ON public.task_chat_messages;
CREATE POLICY "task_chat_delete" ON public.task_chat_messages
    FOR DELETE TO authenticated
    USING (
        sender_id = auth.uid()
        OR public.is_project_owner(project_id)
        OR public.get_user_project_role(project_id) = 'MANAGER'
    );

-- Read cursors are private per user. Task access is checked at creation time;
-- a revoked user then loses SELECT access through can_access_task_chat.
DROP POLICY IF EXISTS "task_chat_reads_select_own" ON public.task_chat_reads;
CREATE POLICY "task_chat_reads_select_own" ON public.task_chat_reads
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        AND public.can_access_task_chat(
            task_id,
            (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
        )
    );

DROP POLICY IF EXISTS "task_chat_reads_insert_own" ON public.task_chat_reads;
CREATE POLICY "task_chat_reads_insert_own" ON public.task_chat_reads
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND public.can_access_task_chat(
            task_id,
            (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)
        )
    );

DROP POLICY IF EXISTS "task_chat_reads_update_own" ON public.task_chat_reads;
CREATE POLICY "task_chat_reads_update_own" ON public.task_chat_reads
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. Realtime
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_quality_controls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_chat_reads;

GRANT SELECT, INSERT ON public.task_chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.task_chat_reads TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- END OF MIGRATION
-- ─────────────────────────────────────────────────────────────
