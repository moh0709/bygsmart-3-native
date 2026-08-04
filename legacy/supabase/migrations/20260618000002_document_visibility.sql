-- ============================================================
-- MIGRATION: T3 — Per-Document Visibility Picker
-- Creates document_visibility table and enforces custom_users
-- access via RLS on documents + document_visibility.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. document_visibility table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_visibility (
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  resource_id  uuid        NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_document_visibility_document
  ON public.document_visibility(document_id);
CREATE INDEX IF NOT EXISTS idx_document_visibility_resource
  ON public.document_visibility(resource_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Helper: is the caller listed in document_visibility?
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_document_visibility_listed(p_document_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_visibility dv
    JOIN public.project_resources pr ON pr.id = dv.resource_id
    WHERE dv.document_id = p_document_id
      AND pr.user_id = auth.uid()
      AND pr.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_document_visibility_listed(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Enable RLS + policies on document_visibility
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.document_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_vis_select" ON public.document_visibility;
CREATE POLICY "doc_vis_select" ON public.document_visibility
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (
          public.is_project_owner(d.project_id)
          OR public.get_user_project_role(d.project_id) = 'MANAGER'
          OR public.is_document_visibility_listed(document_id)
        )
    )
  );

DROP POLICY IF EXISTS "doc_vis_insert" ON public.document_visibility;
CREATE POLICY "doc_vis_insert" ON public.document_visibility
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (
          public.is_project_owner(d.project_id)
          OR public.get_user_project_role(d.project_id) = 'MANAGER'
        )
    )
  );

DROP POLICY IF EXISTS "doc_vis_delete" ON public.document_visibility;
CREATE POLICY "doc_vis_delete" ON public.document_visibility
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
        AND (
          public.is_project_owner(d.project_id)
          OR public.get_user_project_role(d.project_id) = 'MANAGER'
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Update documents SELECT policy to enforce custom_users
--    Owners/managers always see all docs.
--    Team members see public_team + managers_only (if manager)
--    + custom_users if listed in document_visibility.
--    Active project_resources (partner) see public_team
--    + custom_users if listed.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "documents_select_member" ON public.documents;

-- public_team: only active resources with visibility in (all,some,standard) — not none, not pending.
-- custom_users: only if explicitly listed in document_visibility as an active resource.
-- managers_only: owner/manager branch above covers this; no separate branch needed.
-- is_project_member() is intentionally NOT used here — it does not check visibility.
CREATE POLICY "documents_select_member" ON public.documents
  FOR SELECT TO authenticated
  USING (
    -- Owner and manager always see all docs
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (
      -- public_team: active project resource with non-restricted visibility
      access_level = 'public_team'
      AND EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = documents.project_id
          AND pr.user_id    = auth.uid()
          AND pr.status     = 'active'
          AND pr.visibility IN ('all', 'some', 'standard')
      )
    )
    OR (
      -- custom_users: resource must be active and explicitly listed
      access_level = 'custom_users'
      AND public.is_document_visibility_listed(id)
    )
  );
