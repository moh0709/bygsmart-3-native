-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 50: Documents, per-doc visibility, regulations reference
-- ============================================================================
-- documents            — SYNCABLE (mutable: is_latest_revision, review_deadline)
-- document_visibility  — SYNCABLE child (composite PK; tombstone via parent)
-- regulations          — static BR18/SBI/DS reference (read-only, bundled offline;
--                        NOT a mutable sync table — no deleted_at / cursor)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 50.1  documents  (metadata mirror; blobs live in the task-docs storage bucket)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name               text NOT NULL,
  storage_path       text NOT NULL,
  size_bytes         bigint NOT NULL DEFAULT 0,
  mime_type          text NOT NULL,
  category           text NOT NULL DEFAULT 'GENERAL',
  reference_no       text,
  short_description  text,
  access_level       text NOT NULL DEFAULT 'public_team',
  password_protected boolean NOT NULL DEFAULT false,
  created_by         text NOT NULL,
  review_deadline    date,
  is_drawing         boolean NOT NULL DEFAULT false,
  discipline         text,
  drawing_no         text,
  revision           text,
  scale              text,
  issue_date         date,
  sheet_no           text,
  plan_type          text,
  plan_index         integer,
  is_latest_revision boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only, yet mutable
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_documents_project    ON public.documents (project_id);
CREATE INDEX IF NOT EXISTS idx_documents_category   ON public.documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_is_drawing ON public.documents (is_drawing);
CREATE INDEX IF NOT EXISTS idx_documents_sync       ON public.documents (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted    ON public.documents (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER documents_emit_tombstone AFTER UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();
CREATE TRIGGER documents_cascade_visibility AFTER UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('document_visibility', 'document_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- 50.2  document_visibility  (custom_users picker; composite PK)
--       Child of documents AND project_resources — soft-deleted by either
--       parent's cascade; deletion event derives from the parent tombstone.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_visibility (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  PRIMARY KEY (document_id, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_doc_vis_document ON public.document_visibility (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_vis_resource ON public.document_visibility (resource_id);
CREATE INDEX IF NOT EXISTS idx_doc_vis_sync     ON public.document_visibility (updated_at, document_id, resource_id);

CREATE TRIGGER doc_vis_set_updated_at BEFORE UPDATE ON public.document_visibility
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 50.3  regulations  (static reference; Danish FTS; read-only, service-role writes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulations (
  id             text PRIMARY KEY,
  title          text NOT NULL,
  chapter        text NOT NULL DEFAULT '',
  section_ref    text NOT NULL DEFAULT '',
  snippet        text NOT NULL DEFAULT '',
  body_html      text NOT NULL DEFAULT '',
  effective_from text NOT NULL DEFAULT '',
  tags           jsonb NOT NULL DEFAULT '[]'::jsonb,
  version        text NOT NULL DEFAULT '',
  source_url     text NOT NULL DEFAULT '',
  category       text NOT NULL DEFAULT 'BR18'
);
CREATE INDEX IF NOT EXISTS idx_regulations_search
  ON public.regulations USING GIN (to_tsvector('danish', title || ' ' || snippet || ' ' || body_html));
CREATE INDEX IF NOT EXISTS idx_regulations_category ON public.regulations (category);
CREATE INDEX IF NOT EXISTS idx_regulations_tags     ON public.regulations USING GIN (tags);
