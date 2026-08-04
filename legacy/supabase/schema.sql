-- ============================================================
-- BYGGESMART 2.0 - Complete Production Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor (in order, top to bottom).
-- Project: pkzburssqetnlcbvabdq
-- ============================================================

-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- For full-text search on regulations

-- ============================================================
-- SECTION 2: CUSTOM TYPES (ENUMS)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('FREE', 'PRO', 'PREMIUM', 'ENTERPRISE');

EXCEPTION WHEN duplicate_object THEN NULL;

END $$;

DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status_type AS ENUM ('ACTIVE', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_level_type AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SECTION 3: HELPER FUNCTION - updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 4: PROFILES TABLE
-- Extends auth.users with app-specific data.
-- Linked 1:1 to Supabase Auth.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    initials TEXT NOT NULL DEFAULT '',
    email TEXT,
    avatar_url TEXT,
    subscription_tier subscription_tier NOT NULL DEFAULT 'FREE',
    ai_requests_today INTEGER NOT NULL DEFAULT 0,
    ai_last_reset_date DATE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for username lookup (login)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Auto-create profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username_val TEXT;
BEGIN
  -- Generate a unique username from email or metadata
  username_val := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 1000)::TEXT
  );

  INSERT INTO public.profiles (id, username, name, initials, email, subscription_tier)
  VALUES (
    NEW.id,
    username_val,
    COALESCE(NEW.raw_user_meta_data->>'name', username_val),
    COALESCE(NEW.raw_user_meta_data->>'initials', UPPER(LEFT(username_val, 2))),
    NEW.email,
    'FREE'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SECTION 5: USER CONNECTIONS
-- Peer-to-peer colleague connections.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_connections (
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    connected_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, connected_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_connections_user ON public.user_connections (user_id);

-- ============================================================
-- SECTION 6: REGULATIONS TABLE
-- Static reference data (BR18, SBI, DS, AB18, AT).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regulations (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  chapter        TEXT NOT NULL DEFAULT '',
  section_ref    TEXT NOT NULL DEFAULT '',
  snippet        TEXT NOT NULL DEFAULT '',
  body_html      TEXT NOT NULL DEFAULT '',
  effective_from TEXT NOT NULL DEFAULT '',
  tags           JSONB NOT NULL DEFAULT '[]'::JSONB,
  version        TEXT NOT NULL DEFAULT '',
  source_url     TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT 'BR18'
);

-- Full-text search index on regulations
CREATE INDEX IF NOT EXISTS idx_regulations_search ON public.regulations USING GIN (
    to_tsvector (
        'danish',
        title || ' ' || snippet || ' ' || body_html
    )
);

CREATE INDEX IF NOT EXISTS idx_regulations_category ON public.regulations (category);

CREATE INDEX IF NOT EXISTS idx_regulations_tags ON public.regulations USING GIN (tags);

-- ============================================================
-- SECTION 7: PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_number   TEXT,
  name             TEXT NOT NULL,
  client_name      TEXT,
  status           TEXT NOT NULL DEFAULT 'I gang',
  progress         INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date       DATE,
  end_date         DATE,
  address          TEXT,
  description      TEXT,
  regulation_count INTEGER NOT NULL DEFAULT 0,
  checklist_count  INTEGER NOT NULL DEFAULT 0,
  is_favorite      BOOLEAN NOT NULL DEFAULT FALSE,
  floor_plan_url   TEXT,
  milestone        JSONB NOT NULL DEFAULT '{"title":"","dueDateRelative":""}'::JSONB,
  team             JSONB NOT NULL DEFAULT '[]'::JSONB,
  budget                      JSONB,  -- { total: number, used: number }
  acceptance_report_settings  JSONB,  -- partner acceptance report configuration
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects (owner_id);

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);

-- ============================================================
-- SECTION 8: TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID        NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id              UUID        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  scope                 TEXT        NOT NULL DEFAULT 'project'
                                    CHECK (scope IN ('project', 'quick')),
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'To Do',
  due_date              DATE,
  description           TEXT,
  is_milestone          BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
  step                  TEXT,
  related_link          JSONB,
  assignees             JSONB NOT NULL DEFAULT '[]'::JSONB,
  checklist             JSONB NOT NULL DEFAULT '[]'::JSONB,
  attachments           JSONB NOT NULL DEFAULT '[]'::JSONB,
  comments              JSONB NOT NULL DEFAULT '[]'::JSONB,
  suggested_regulations JSONB NOT NULL DEFAULT '[]'::JSONB,
  dependencies          JSONB NOT NULL DEFAULT '[]'::JSONB,
  completed_at          TIMESTAMPTZ,
  archived_at           TIMESTAMPTZ,
  acceptance_report_path TEXT,
  handover_status       TEXT NOT NULL DEFAULT 'none'
                        CHECK (handover_status IN ('none', 'submitted', 'accepted', 'rejected')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks (project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
-- GIN index for assignees (JSONB array search)
CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON public.tasks USING GIN (assignees);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_scope ON public.tasks (owner_id, scope);
CREATE INDEX IF NOT EXISTS idx_tasks_scope       ON public.tasks (scope);
CREATE INDEX IF NOT EXISTS idx_tasks_archived    ON public.tasks (archived_at)
  WHERE archived_at IS NOT NULL;

-- ============================================================
-- SECTION 9: PURCHASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    details TEXT,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Afventer',
    supplier TEXT,
    item_number TEXT,
    attachment JSONB,
    expected_delivery_date DATE,
    task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_purchases_project ON public.purchases (project_id);

CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases (status);

-- ============================================================
-- SECTION 10: REMINDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date_time TIMESTAMPTZ NOT NULL,
    context TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_project ON public.reminders (project_id);

CREATE INDEX IF NOT EXISTS idx_reminders_date ON public.reminders (date_time);

-- ============================================================
-- SECTION 11: ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'completed' | 'upload' | 'addUser'
    user_name TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON public.activity_log (project_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON public.activity_log (timestamp DESC);

-- ============================================================
-- SECTION 12: PUNCH LIST TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.punch_list_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reference TEXT,
    file_url TEXT NOT NULL, -- Supabase Storage path or public URL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punch_layouts_project ON public.punch_list_layouts (project_id);

CREATE TABLE IF NOT EXISTS public.punch_list_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  layout_id            UUID NOT NULL REFERENCES public.punch_list_layouts(id) ON DELETE CASCADE,
  photo_url            TEXT,  -- Supabase Storage path
  pin                  JSONB NOT NULL DEFAULT '{"x":50,"y":50}'::JSONB,
  description          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'Åben',
  resolution_due_date  DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER punch_list_items_updated_at
  BEFORE UPDATE ON public.punch_list_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_punch_items_project ON public.punch_list_items (project_id);

CREATE INDEX IF NOT EXISTS idx_punch_items_layout ON public.punch_list_items (layout_id);

CREATE INDEX IF NOT EXISTS idx_punch_items_status ON public.punch_list_items (status);

-- ============================================================
-- SECTION 13: DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Supabase Storage: bucket/path/file.pdf
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    reference_no TEXT,
    short_description TEXT,
    access_level TEXT NOT NULL DEFAULT 'public_team',
    password_protected BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL, -- Profile name (denormalized for display)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_deadline DATE,
    -- Drawing-specific fields
    is_drawing BOOLEAN NOT NULL DEFAULT FALSE,
    discipline TEXT,
    drawing_no TEXT,
    revision TEXT,
    scale TEXT,
    issue_date DATE,
    sheet_no TEXT,
    plan_type TEXT,
    plan_index INTEGER,
    is_latest_revision BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON public.documents (project_id);

CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents (category);

CREATE INDEX IF NOT EXISTS idx_documents_is_drawing ON public.documents (is_drawing);

-- ============================================================
-- SECTION 13b: DOCUMENT VISIBILITY TABLE (T3)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_visibility (
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  resource_id  uuid        NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_document_visibility_document ON public.document_visibility(document_id);
CREATE INDEX IF NOT EXISTS idx_document_visibility_resource ON public.document_visibility(resource_id);

-- ============================================================
-- SECTION 14: TIME ENTRIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    project_id UUID        NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    user_name TEXT NOT NULL, -- Denormalized for fast display
    hours NUMERIC(6, 2) NOT NULL CHECK (hours > 0),
    date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON public.time_entries (project_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries (user_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries (date DESC);

-- ============================================================
-- SECTION 14b: TASK WORKSPACE TABLES
--   task_documentation, task_check_ins, task_handovers
--   (added by migration 20260615000001_task_workspace_schema)
-- ============================================================

-- task_documentation: evidence records (text, photos, audio, links, files, reports)
CREATE TABLE IF NOT EXISTS public.task_documentation (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id   UUID        NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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

-- task_check_ins: GPS-stamped work sessions per user per task
CREATE TABLE IF NOT EXISTS public.task_check_ins (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id          UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id       UUID        NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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

-- One open session (no check-out) per user at a time (globally, across all tasks).
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_check_ins_one_active_per_user
    ON public.task_check_ins(user_id)
    WHERE checked_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_check_ins_task
    ON public.task_check_ins(task_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_check_ins_user
    ON public.task_check_ins(user_id);

-- task_handovers: formal two-party acceptance workflow (submitted→accepted/rejected)
CREATE TABLE IF NOT EXISTS public.task_handovers (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                 UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id              UUID        NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
-- Trigger guard: task_handovers INSERT + UPDATE transitions
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

    IF public.is_project_owner(v_project_id)
       OR public.get_user_project_role(v_project_id) = 'MANAGER'
    THEN
        RETURN NEW;
    END IF;

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

DROP TRIGGER IF EXISTS task_handovers_guard_op ON public.task_handovers;

CREATE TRIGGER task_handovers_guard_op
    BEFORE INSERT OR UPDATE ON public.task_handovers
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_handover_op();

-- ============================================================
-- SECTION 14c: QUICK TASK ACCESS TABLE
--   Projectless delegation model — allows quick-task owners to
--   grant access to other users without a project_resources row.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quick_task_access (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  status     text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quick_task_access_task ON public.quick_task_access(task_id);
CREATE INDEX IF NOT EXISTS idx_quick_task_access_user ON public.quick_task_access(user_id);

ALTER TABLE public.quick_task_access ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Helper: does the caller have delegated access to a quick task?
-- SECURITY DEFINER: only queries quick_task_access, never tasks.
-- Safe to call from tasks RLS policies — no re-entry into tasks.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_accessible(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check quick_task_access directly without re-querying tasks (avoids RLS recursion)
  RETURN EXISTS (
    SELECT 1 FROM public.quick_task_access qta
    WHERE qta.task_id = p_task_id
      AND qta.user_id = auth.uid()
      AND qta.status IN ('pending', 'active')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_quick_task_accessible(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Helper: does the caller own a quick task?
-- SECURITY DEFINER runs as postgres (superuser) — tasks RLS bypassed.
-- Safe to call from quick_task_access RLS policies without re-entering tasks RLS.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_quick_task_owner(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Bypasses RLS by using SECURITY DEFINER; only checks owner_id and scope
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.owner_id = auth.uid()
      AND t.scope = 'quick'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_quick_task_owner(UUID) TO authenticated;

-- Accepted-partner-only access helper — canonical version uses resource_task_access.
-- Legacy alias kept for backward compat with old workspace policies still in flight.
CREATE OR REPLACE FUNCTION public.has_accepted_partner_task_access(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Canonical table: resource_task_access (replaces partner_task_access)
    RETURN EXISTS (
        SELECT 1
        FROM public.resource_task_access rta
        JOIN public.project_resources pr ON pr.id = rta.resource_id
        WHERE rta.task_id = p_task_id
          AND pr.user_id  = auth.uid()
          AND pr.kind     = 'partner'
          AND pr.status  IN ('pending', 'active')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Aggregate total hours on a task; SECURITY DEFINER bypasses RLS so that
-- both project members and accepted partners see the full task total, not
-- just their own rows. Uses canonical resource_task_access for partner gating.
CREATE OR REPLACE FUNCTION public.get_task_time_total(p_task_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total   NUMERIC;
    v_project UUID;
BEGIN
    SELECT project_id INTO v_project FROM public.tasks WHERE id = p_task_id;

    IF NOT (
        (v_project IS NOT NULL AND public.is_project_member(v_project))
        OR public.has_accepted_partner_task_access(p_task_id)
        OR public.is_quick_task_accessible(p_task_id)
    ) THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(SUM(hours), 0)
    INTO v_total
    FROM public.time_entries
    WHERE task_id = p_task_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_task_time_total(UUID) TO authenticated;

-- ============================================================
-- SECTION 15: NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, is_read)
WHERE
    is_read = FALSE;

-- ============================================================
-- SECTION 16: LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level log_level_type NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON public.logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_level ON public.logs (level);
-- Auto-delete logs older than 30 days (cleanup function)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.logs WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 17: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.punch_list_layouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.punch_list_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_documentation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_check_ins ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_handovers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS HELPER: Check if user is a member of a project
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
    AND (
      p.owner_id = auth.uid()
      OR (p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT)))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_project_role(p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check if owner
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = auth.uid()) THEN
    RETURN 'OWNER';
  END IF;
  -- Get role from team JSONB array
  SELECT member->>'role' INTO v_role
  FROM public.projects p,
       jsonb_array_elements(p.team) AS member
  WHERE p.id = p_project_id
    AND member->>'id' = auth.uid()::TEXT
  LIMIT 1;

  RETURN COALESCE(v_role, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Returns true if the caller may see budget fields on a project.
CREATE OR REPLACE FUNCTION public.can_view_project_budget(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = auth.uid()) THEN
    RETURN TRUE;
  END IF;
  IF public.get_user_project_role(p_project_id) = 'MANAGER' THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND visibility = 'all'
      AND status     = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_view_project_budget(UUID) TO authenticated;

-- Returns true if the caller is an active (accepted) project resource.
CREATE OR REPLACE FUNCTION public.is_active_project_resource(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND status     = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_active_project_resource(UUID) TO authenticated;

-- Returns true if the caller is listed in document_visibility as an active resource.
CREATE OR REPLACE FUNCTION public.is_document_visibility_listed(p_document_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.document_visibility dv
    JOIN public.project_resources pr ON pr.id = dv.resource_id
    WHERE dv.document_id = p_document_id
      AND pr.user_id = auth.uid()
      AND pr.status  = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_document_visibility_listed(UUID) TO authenticated;

-- Returns all projects the caller can access, with budget nulled for non-privileged callers.
CREATE OR REPLACE FUNCTION public.get_projects_guarded()
RETURNS TABLE (
  id               UUID,
  owner_id         UUID,
  project_number   TEXT,
  name             TEXT,
  client_name      TEXT,
  status           TEXT,
  progress         INTEGER,
  start_date       DATE,
  end_date         DATE,
  address          TEXT,
  description      TEXT,
  regulation_count INTEGER,
  checklist_count  INTEGER,
  is_favorite      BOOLEAN,
  floor_plan_url   TEXT,
  milestone        JSONB,
  team             JSONB,
  budget           JSONB,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.owner_id,
      p.project_number,
      p.name,
      p.client_name,
      p.status,
      p.progress,
      p.start_date,
      p.end_date,
      p.address,
      p.description,
      p.regulation_count,
      p.checklist_count,
      p.is_favorite,
      p.floor_plan_url,
      p.milestone,
      p.team,
      CASE
        WHEN public.can_view_project_budget(p.id) THEN p.budget
        ELSE NULL
      END AS budget,
      p.created_at,
      p.updated_at
    FROM public.projects p
    WHERE
      p.owner_id = auth.uid()
      OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = p.id
          AND pr.user_id    = auth.uid()
          AND pr.status IN ('pending', 'active')
          AND pr.kind       != 'partner'
      )
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projects_guarded() TO authenticated;

-- Returns a single project the caller can access (owner/team only, not partner resources),
-- with budget conditionally nulled for non-privileged callers.
CREATE OR REPLACE FUNCTION public.get_project_guarded(p_project_id UUID)
RETURNS TABLE (
  id               UUID,
  owner_id         UUID,
  project_number   TEXT,
  name             TEXT,
  client_name      TEXT,
  status           TEXT,
  progress         INTEGER,
  start_date       DATE,
  end_date         DATE,
  address          TEXT,
  description      TEXT,
  regulation_count INTEGER,
  checklist_count  INTEGER,
  is_favorite      BOOLEAN,
  floor_plan_url   TEXT,
  milestone        JSONB,
  team             JSONB,
  budget           JSONB,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id,
      p.owner_id,
      p.project_number,
      p.name,
      p.client_name,
      p.status,
      p.progress,
      p.start_date,
      p.end_date,
      p.address,
      p.description,
      p.regulation_count,
      p.checklist_count,
      p.is_favorite,
      p.floor_plan_url,
      p.milestone,
      p.team,
      CASE
        WHEN public.can_view_project_budget(p.id) THEN p.budget
        ELSE NULL
      END AS budget,
      p.created_at,
      p.updated_at
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        p.owner_id = auth.uid()
        OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
        OR EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = p.id
            AND pr.user_id = auth.uid()
            AND pr.status IN ('pending', 'active')
            AND pr.kind != 'partner'
        )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_guarded(UUID) TO authenticated;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR
SELECT USING (auth.uid () = id);

DROP POLICY IF EXISTS "profiles_select_connected" ON public.profiles;

CREATE POLICY "profiles_select_connected" ON public.profiles FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.user_connections
            WHERE
                user_id = auth.uid ()
                AND connected_user_id = id
        )
    );

-- F-02 fix: a profile is visible to the caller only when BOTH the caller AND the
-- target profile are members (owner or team) of the SAME project. The previous
-- version had an uncorrelated `p.owner_id = auth.uid()` branch that let any project
-- owner read every profile row. SECURITY DEFINER bypasses projects RLS and never
-- reads profiles, so it cannot recurse into the profiles policies that call it.
CREATE OR REPLACE FUNCTION public.shares_project_with_caller(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE (
            p.owner_id = auth.uid()
            OR p.team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
          )
      AND (
            p.owner_id = p_profile_id
            OR p.team @> jsonb_build_array(jsonb_build_object('id', p_profile_id::TEXT))
          )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.shares_project_with_caller(UUID) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_project_member" ON public.profiles;

CREATE POLICY "profiles_select_project_member"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ( public.shares_project_with_caller(id) );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles FOR
UPDATE USING (auth.uid () = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_insert_own" ON public.profiles FOR
INSERT
WITH
    CHECK (auth.uid () = id);

-- ============================================================
-- USER CONNECTIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "connections_select_own" ON public.user_connections;

CREATE POLICY "connections_select_own" ON public.user_connections FOR
SELECT USING (
        auth.uid () = user_id
        OR auth.uid () = connected_user_id
    );

DROP POLICY IF EXISTS "connections_insert_own" ON public.user_connections;

CREATE POLICY "connections_insert_own" ON public.user_connections FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS "connections_delete_own" ON public.user_connections;

CREATE POLICY "connections_delete_own" ON public.user_connections FOR DELETE USING (auth.uid () = user_id);

-- ============================================================
-- REGULATIONS POLICIES (read-only for all authenticated users)
-- ============================================================
DROP POLICY IF EXISTS "regulations_select_all" ON public.regulations;

CREATE POLICY "regulations_select_all" ON public.regulations FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

-- Only service role can insert/update regulations (admin seed)
DROP POLICY IF EXISTS "regulations_insert_service" ON public.regulations;

CREATE POLICY "regulations_insert_service" ON public.regulations FOR
INSERT
WITH
    CHECK (auth.role () = 'service_role');

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "projects_select_member" ON public.projects;

CREATE POLICY "projects_select_member"
  ON public.projects FOR SELECT
  USING (
    owner_id = auth.uid()
    OR team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
  );

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;

CREATE POLICY "projects_insert_own" ON public.projects FOR
INSERT
WITH
    CHECK (owner_id = auth.uid ());

DROP POLICY IF EXISTS "projects_update_owner_manager" ON public.projects;

CREATE POLICY "projects_update_owner_manager"
  ON public.projects FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR (
      team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
      AND get_user_project_role(id) IN ('MANAGER')
    )
  );

DROP POLICY IF EXISTS "projects_delete_owner" ON public.projects;

CREATE POLICY "projects_delete_owner" ON public.projects FOR DELETE USING (owner_id = auth.uid ());

-- ============================================================
-- TASKS POLICIES
-- Project-task policies: visibility-aware (T2) + project_id guard (T5)
-- Quick-task policies: owner/assignee/quick_task_access delegation
-- ============================================================

-- ── Project tasks ────────────────────────────────────────────
-- SELECT: owner/manager see all; 'all'-visibility resource sees all;
--   standard/some resource sees only assigned tasks; project_id non-null.
DROP POLICY IF EXISTS "tasks_select_project_member" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_resource_access" ON public.tasks;

CREATE POLICY "tasks_select_project_member" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = tasks.project_id
          AND pr.user_id    = auth.uid()
          AND pr.visibility = 'all'
          AND pr.status IN ('pending', 'active')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = tasks.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility IN ('standard', 'some')
            AND pr.status IN ('pending', 'active')
        )
        AND tasks.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      )
    )
  );

-- INSERT: project-task only — owner/manager, project_id non-null
DROP POLICY IF EXISTS "tasks_insert_owner_manager" ON public.tasks;

CREATE POLICY "tasks_insert_owner_manager" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
    )
  );

-- UPDATE: mirrors T2 visibility — owner/manager/all-visibility; or assigned standard/some member.
--   project_id must be non-null (project tasks only).
DROP POLICY IF EXISTS "tasks_update_project_member" ON public.tasks;

CREATE POLICY "tasks_update_project_member" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = tasks.project_id
          AND pr.user_id    = auth.uid()
          AND pr.visibility = 'all'
          AND pr.status IN ('pending', 'active')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = tasks.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility IN ('standard', 'some')
            AND pr.status IN ('pending', 'active')
        )
        AND tasks.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      )
    )
  );

-- DELETE: owner/manager only, project_id non-null
DROP POLICY IF EXISTS "tasks_delete_owner_manager" ON public.tasks;

CREATE POLICY "tasks_delete_owner_manager" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      public.is_project_owner(project_id)
      OR public.get_user_project_role(project_id) = 'MANAGER'
    )
  );

-- ── Quick tasks ───────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select_quick" ON public.tasks;
CREATE POLICY "tasks_select_quick" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR public.is_quick_task_accessible(id)
    )
  );

DROP POLICY IF EXISTS "tasks_insert_quick" ON public.tasks;
CREATE POLICY "tasks_insert_quick" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    scope = 'quick'
    AND project_id IS NULL
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "tasks_update_quick" ON public.tasks;
CREATE POLICY "tasks_update_quick" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    scope = 'quick'
    AND (
      owner_id = auth.uid()
      OR assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
      OR public.is_quick_task_accessible(id)
    )
  );

DROP POLICY IF EXISTS "tasks_delete_quick" ON public.tasks;
CREATE POLICY "tasks_delete_quick" ON public.tasks
  FOR DELETE TO authenticated
  USING (scope = 'quick' AND owner_id = auth.uid());

-- ============================================================
-- QUICK TASK ACCESS POLICIES
-- ============================================================

-- Task owner or invited user can see the row
DROP POLICY IF EXISTS "qta_select" ON public.quick_task_access;
CREATE POLICY "qta_select" ON public.quick_task_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- Only the quick-task owner can grant access
DROP POLICY IF EXISTS "qta_insert" ON public.quick_task_access;
CREATE POLICY "qta_insert" ON public.quick_task_access
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_quick_task_owner(task_id)
  );

-- Invitee can update their own row (accept/decline); owner can update any
DROP POLICY IF EXISTS "qta_update_self" ON public.quick_task_access;
CREATE POLICY "qta_update_self" ON public.quick_task_access
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- Task owner or the invited user can revoke access
DROP POLICY IF EXISTS "qta_delete" ON public.quick_task_access;
CREATE POLICY "qta_delete" ON public.quick_task_access
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_quick_task_owner(task_id)
  );

-- ============================================================
-- PURCHASES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "purchases_select_project_member" ON public.purchases;

CREATE POLICY "purchases_select_project_member" ON public.purchases FOR
SELECT USING (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "purchases_insert_owner_manager" ON public.purchases;

CREATE POLICY "purchases_insert_owner_manager" ON public.purchases FOR
INSERT
WITH
    CHECK (
        is_project_owner (project_id)
        OR get_user_project_role (project_id) IN ('MANAGER', 'EMPLOYEE')
    );

DROP POLICY IF EXISTS "purchases_update_owner_manager" ON public.purchases;

CREATE POLICY "purchases_update_owner_manager" ON public.purchases FOR
UPDATE USING (
    is_project_owner (project_id)
    OR get_user_project_role (project_id) IN ('MANAGER', 'EMPLOYEE')
);

DROP POLICY IF EXISTS "purchases_delete_owner_manager" ON public.purchases;

CREATE POLICY "purchases_delete_owner_manager" ON public.purchases FOR DELETE USING (
    is_project_owner (project_id)
    OR get_user_project_role (project_id) = 'MANAGER'
);

-- ============================================================
-- REMINDERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "reminders_project_member" ON public.reminders;
DROP POLICY IF EXISTS "reminders_select" ON public.reminders;
DROP POLICY IF EXISTS "reminders_insert" ON public.reminders;
DROP POLICY IF EXISTS "reminders_update" ON public.reminders;
DROP POLICY IF EXISTS "reminders_delete" ON public.reminders;

-- Owner/manager see all; full-visibility members see all; others see only their own.
-- created_by IS NULL rows visible to owner/manager only (legacy rows without author).
CREATE POLICY "reminders_select" ON public.reminders
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (
      public.is_project_member(project_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = reminders.project_id
            AND pr.user_id    = auth.uid()
            AND pr.visibility = 'all'
            AND pr.status IN ('active', 'pending')
        )
        OR created_by = auth.uid()
      )
    )
    OR (
      public.is_active_project_resource(project_id)
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "reminders_insert" ON public.reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR public.is_project_member(project_id)
  );

CREATE POLICY "reminders_update" ON public.reminders
  FOR UPDATE TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (public.is_project_member(project_id) AND created_by = auth.uid())
  );

CREATE POLICY "reminders_delete" ON public.reminders
  FOR DELETE TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (public.is_project_member(project_id) AND created_by = auth.uid())
  );

-- ============================================================
-- ACTIVITY LOG POLICIES
-- ============================================================
DROP POLICY IF EXISTS "activity_log_select" ON public.activity_log;

CREATE POLICY "activity_log_select" ON public.activity_log FOR
SELECT USING (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;

CREATE POLICY "activity_log_insert" ON public.activity_log FOR
INSERT
WITH
    CHECK (
        is_project_member (project_id)
    );

-- ============================================================
-- PUNCH LIST POLICIES
-- ============================================================
DROP POLICY IF EXISTS "punch_layouts_project_member" ON public.punch_list_layouts;

CREATE POLICY "punch_layouts_project_member" ON public.punch_list_layouts FOR ALL USING (
    is_project_member (project_id)
)
WITH
    CHECK (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "punch_items_project_member" ON public.punch_list_items;

CREATE POLICY "punch_items_project_member" ON public.punch_list_items FOR ALL USING (
    is_project_member (project_id)
)
WITH
    CHECK (
        is_project_member (project_id)
    );

-- ============================================================
-- DOCUMENTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "documents_select_member" ON public.documents;

-- public_team: only active resources with non-restricted visibility (all, some, standard).
-- custom_users: only if explicitly listed in document_visibility as an active resource.
-- managers_only: covered by the owner/manager branches only.
-- is_project_member() is intentionally NOT used — it does not check visibility.
CREATE POLICY "documents_select_member" ON public.documents FOR
SELECT TO authenticated USING (
    public.is_project_owner (project_id)
    OR public.get_user_project_role (project_id) = 'MANAGER'
    OR (
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
        access_level = 'custom_users'
        AND public.is_document_visibility_listed (id)
    )
);

DROP POLICY IF EXISTS "documents_insert_member" ON public.documents;

CREATE POLICY "documents_insert_member" ON public.documents FOR
INSERT
WITH
    CHECK (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "documents_update_manager" ON public.documents;

CREATE POLICY "documents_update_manager" ON public.documents FOR
UPDATE USING (
    is_project_owner (project_id)
    OR get_user_project_role (project_id) = 'MANAGER'
);

DROP POLICY IF EXISTS "documents_delete_owner_manager" ON public.documents;

CREATE POLICY "documents_delete_owner_manager" ON public.documents FOR DELETE USING (
    is_project_owner (project_id)
    OR get_user_project_role (project_id) = 'MANAGER'
);

-- ============================================================
-- TIME ENTRIES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;

-- Owners and managers see all entries; full-visibility resources see all;
-- restricted members see only their own entries.
CREATE POLICY "time_entries_select" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_owner(project_id))
        OR (project_id IS NOT NULL AND public.get_user_project_role(project_id) = 'MANAGER')
        OR (
            project_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.project_resources pr
                WHERE pr.project_id = time_entries.project_id
                  AND pr.user_id    = auth.uid()
                  AND pr.visibility = 'all'
                  AND pr.status IN ('pending', 'active')
            )
        )
        OR (
            user_id = auth.uid()
            AND (
                project_id IS NULL
                OR public.is_project_member(project_id)
                OR public.is_active_project_resource(project_id)
            )
        )
    );

DROP POLICY IF EXISTS "time_entries_insert_own" ON public.time_entries;

CREATE POLICY "time_entries_insert_own" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            project_id IS NULL
            OR public.is_project_member(project_id)
        )
    );

DROP POLICY IF EXISTS "time_entries_update_own" ON public.time_entries;

CREATE POLICY "time_entries_update_own" ON public.time_entries FOR
UPDATE USING (user_id = auth.uid ());

DROP POLICY IF EXISTS "time_entries_delete_own_or_manager" ON public.time_entries;

CREATE POLICY "time_entries_delete_own_or_manager" ON public.time_entries FOR DELETE USING (
    user_id = auth.uid ()
    OR is_project_owner (project_id)
    OR get_user_project_role (project_id) = 'MANAGER'
);

-- Accepted partners can log time on their assigned tasks (canonical resource_task_access).
DROP POLICY IF EXISTS "time_entries_insert_partner" ON public.time_entries;
CREATE POLICY "time_entries_insert_partner" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND task_id IS NOT NULL
        AND public.has_accepted_partner_task_access(task_id)
    );

-- Partners may read all time entries on tasks they have accepted access to,
-- not only their own, so that task-total hour aggregations are accurate.
DROP POLICY IF EXISTS "time_entries_select_partner" ON public.time_entries;
CREATE POLICY "time_entries_select_partner" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        task_id IS NOT NULL
        AND public.has_accepted_partner_task_access(task_id)
    );

-- ============================================================
-- TASK DOCUMENTATION POLICIES
-- ============================================================
DROP POLICY IF EXISTS "task_docs_select" ON public.task_documentation;
CREATE POLICY "task_docs_select" ON public.task_documentation
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_docs_insert" ON public.task_documentation;
CREATE POLICY "task_docs_insert" ON public.task_documentation
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
        )
    );

DROP POLICY IF EXISTS "task_docs_update_own" ON public.task_documentation;
CREATE POLICY "task_docs_update_own" ON public.task_documentation
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- Project owner / manager may update the comments column on any doc in the
-- project. Application layer (addCommentToTaskDoc) only updates `comments`.
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

-- ============================================================
-- TASK CHECK-INS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "task_check_ins_select" ON public.task_check_ins;
CREATE POLICY "task_check_ins_select" ON public.task_check_ins
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_check_ins_insert" ON public.task_check_ins;
CREATE POLICY "task_check_ins_insert" ON public.task_check_ins
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
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

-- Caller's own open check-in session, enriched with task title and project
-- name. SECURITY DEFINER so joined tasks/projects RLS (narrower than
-- task_check_ins_select — no accepted-partner branch on tasks) cannot hide
-- an authorized session; only rows with user_id = auth.uid() are returned.
CREATE OR REPLACE FUNCTION public.get_my_active_check_in()
RETURNS TABLE (
    task_id       UUID,
    task_title    TEXT,
    project_name  TEXT,
    checked_in_at TIMESTAMPTZ
) AS $$
    SELECT
        ci.task_id,
        COALESCE(t.title, '') AS task_title,
        p.name                AS project_name,
        ci.checked_in_at
    FROM public.task_check_ins ci
    LEFT JOIN public.tasks    t ON t.id = ci.task_id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE ci.user_id = auth.uid()
      AND ci.checked_out_at IS NULL
    ORDER BY ci.checked_in_at DESC
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_my_active_check_in() TO authenticated;

-- ============================================================
-- TASK HANDOVERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "task_handovers_select" ON public.task_handovers;
CREATE POLICY "task_handovers_select" ON public.task_handovers
    FOR SELECT TO authenticated
    USING (
        (project_id IS NOT NULL AND public.is_project_member(project_id))
        OR public.has_accepted_partner_task_access(task_id)
        OR public.is_quick_task_accessible(task_id)
    );

DROP POLICY IF EXISTS "task_handovers_insert" ON public.task_handovers;
CREATE POLICY "task_handovers_insert" ON public.task_handovers
    FOR INSERT TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND (
            (project_id IS NOT NULL AND public.is_project_member(project_id))
            OR public.has_accepted_partner_task_access(task_id)
            OR public.is_quick_task_accessible(task_id)
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

-- ============================================================
-- NOTIFICATIONS POLICIES (strictly per-user)
-- ============================================================
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;

CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (user_id = auth.uid ())
WITH
    CHECK (user_id = auth.uid ());

-- ============================================================
-- LOGS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "logs_select_own" ON public.logs;

CREATE POLICY "logs_select_own" ON public.logs FOR
SELECT USING (
        user_id = auth.uid ()
        OR user_id IS NULL
    );

DROP POLICY IF EXISTS "logs_insert_own" ON public.logs;

CREATE POLICY "logs_insert_own" ON public.logs FOR
INSERT
WITH
    CHECK (
        user_id = auth.uid ()
        OR user_id IS NULL
    );

DROP POLICY IF EXISTS "logs_delete_own" ON public.logs;

CREATE POLICY "logs_delete_own" ON public.logs FOR DELETE USING (user_id = auth.uid ());

-- ============================================================
-- SECTION 18: REALTIME (enable on key tables for live updates)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

ALTER PUBLICATION supabase_realtime
ADD
TABLE public.punch_list_items;

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_documentation;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_check_ins;

ALTER PUBLICATION supabase_realtime ADD TABLE public.task_handovers;

-- ============================================================
-- SECTION 19: STORAGE BUCKETS
-- ============================================================
-- Buckets project-files, punch-photos, floor-plans, avatars:
-- create via Supabase Dashboard or management API (or uncomment):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('punch-photos', 'punch-photos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- task-docs bucket: created and secured by SQL so fresh-schema
-- installs match the migrated state (migration 20260615000001).
-- Path conventions:
--   • {project_id}/{task_id}/{uuid}.ext  — task evidence files
--   • signatures/{user_id}/{uuid}.png    — handover signatures

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-docs', 'task-docs', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Safe path parsers for storage policies (guard against UUID cast errors)
CREATE OR REPLACE FUNCTION public.storage_taskdocs_project_member(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_seg1 TEXT; v_proj UUID; BEGIN
    v_seg1 := split_part(object_name, '/', 1);
    IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN FALSE; END IF;
    BEGIN v_proj := v_seg1::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RETURN FALSE; END;
    RETURN public.is_project_member(v_proj);
END; $$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.storage_taskdocs_accepted_partner(object_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_seg1 TEXT; v_seg2 TEXT; v_task_id UUID; BEGIN
    v_seg1 := split_part(object_name, '/', 1);
    IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN FALSE; END IF;
    v_seg2 := split_part(object_name, '/', 2);
    IF v_seg2 = '' THEN RETURN FALSE; END IF;
    BEGIN v_task_id := v_seg2::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RETURN FALSE; END;
    RETURN public.has_accepted_partner_task_access(v_task_id);
END; $$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

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
        )
    );

-- ============================================================
-- SECTION 20: USEFUL VIEWS
-- ============================================================

-- View: projects with member count for dashboard
CREATE OR REPLACE VIEW public.projects_summary AS
SELECT
    p.id,
    p.name,
    p.status,
    p.progress,
    p.start_date,
    p.end_date,
    p.is_favorite,
    p.owner_id,
    p.project_number,
    p.client_name,
    jsonb_array_length (p.team) AS team_size,
    (
        SELECT COUNT(*)
        FROM public.tasks t
        WHERE
            t.project_id = p.id
            AND t.status != 'Udført'
    ) AS open_tasks,
    (
        SELECT COUNT(*)
        FROM public.tasks t
        WHERE
            t.project_id = p.id
            AND t.status = 'Forfalden'
    ) AS overdue_tasks,
    p.created_at,
    p.updated_at
FROM public.projects p;

-- ============================================================
-- DONE
-- ============================================================
-- Schema version: 2.0.0
-- Created: 2026-02-17
-- Run time: ~5-10 seconds on fresh project