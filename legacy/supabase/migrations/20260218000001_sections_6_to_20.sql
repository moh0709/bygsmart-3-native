-- ============================================================
-- BYGGESMART 2.0 - Complete Schema (Sections 1-20)
-- Self-contained: includes all prerequisites + main tables
-- Uses gen_random_uuid() (built-in, no extension needed)
-- ============================================================

-- ============================================================
-- PRE-CLEANUP: Drop profiles/user_connections so they can be
-- recreated with correct UUID column types.
-- (These tables may have been created with wrong TEXT types.)
-- ============================================================
DROP TABLE IF EXISTS public.user_connections CASCADE;

DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username_val TEXT;
BEGIN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SECTION 5: USER CONNECTIONS
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
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regulations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    chapter TEXT NOT NULL DEFAULT '',
    section_ref TEXT NOT NULL DEFAULT '',
    snippet TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL DEFAULT '',
    effective_from TEXT NOT NULL DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]'::JSONB,
    version TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'BR18'
);

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    project_number TEXT,
    name TEXT NOT NULL,
    client_name TEXT,
    status TEXT NOT NULL DEFAULT 'I gang',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    start_date DATE,
    end_date DATE,
    address TEXT,
    description TEXT,
    regulation_count INTEGER NOT NULL DEFAULT 0,
    checklist_count INTEGER NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    floor_plan_url TEXT,
    milestone JSONB NOT NULL DEFAULT '{"title":"","dueDateRelative":""}'::JSONB,
    team JSONB NOT NULL DEFAULT '[]'::JSONB,
    budget JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'To Do',
    due_date DATE,
    description TEXT,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    step TEXT,
    related_link JSONB,
    assignees JSONB NOT NULL DEFAULT '[]'::JSONB,
    checklist JSONB NOT NULL DEFAULT '[]'::JSONB,
    attachments JSONB NOT NULL DEFAULT '[]'::JSONB,
    comments JSONB NOT NULL DEFAULT '[]'::JSONB,
    offers JSONB NOT NULL DEFAULT '[]'::JSONB,
    suggested_regulations JSONB NOT NULL DEFAULT '[]'::JSONB,
    dependencies JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks (project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON public.tasks USING GIN (assignees);

-- ============================================================
-- SECTION 9: PURCHASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reference TEXT,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punch_layouts_project ON public.punch_list_layouts (project_id);

CREATE TABLE IF NOT EXISTS public.punch_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    layout_id UUID NOT NULL REFERENCES public.punch_list_layouts(id) ON DELETE CASCADE,
    photo_url TEXT,
    pin JSONB NOT NULL DEFAULT '{"x":50,"y":50}'::JSONB,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Åben',
    resolution_due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    reference_no TEXT,
    short_description TEXT,
    access_level TEXT NOT NULL DEFAULT 'public_team',
    password_protected BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_deadline DATE,
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
-- SECTION 14: TIME ENTRIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    hours NUMERIC(6, 2) NOT NULL CHECK (hours > 0),
    date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON public.time_entries (project_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries (user_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries (date DESC);

-- ============================================================
-- SECTION 15: NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level log_level_type NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON public.logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_level ON public.logs (level);

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.logs WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 17: ROW LEVEL SECURITY (RLS)
-- ============================================================
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

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;

-- RLS HELPER FUNCTIONS
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
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND owner_id = auth.uid()) THEN
        RETURN 'OWNER';
    END IF;
    SELECT member->>'role' INTO v_role
    FROM public.projects p, jsonb_array_elements(p.team) AS member
    WHERE p.id = p_project_id AND member->>'id' = auth.uid()::TEXT
    LIMIT 1;
    RETURN COALESCE(v_role, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PROFILES POLICIES
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

DROP POLICY IF EXISTS "profiles_select_project_member" ON public.profiles;

CREATE POLICY "profiles_select_project_member" ON public.profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.owner_id = auth.uid() OR p.team @> jsonb_build_array(jsonb_build_object('id', id::TEXT))
    )
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles FOR
UPDATE USING (auth.uid () = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_insert_own" ON public.profiles FOR
INSERT
WITH
    CHECK (auth.uid () = id);

-- USER CONNECTIONS POLICIES
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

-- REGULATIONS POLICIES
DROP POLICY IF EXISTS "regulations_select_all" ON public.regulations;

CREATE POLICY "regulations_select_all" ON public.regulations FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

DROP POLICY IF EXISTS "regulations_insert_service" ON public.regulations;

CREATE POLICY "regulations_insert_service" ON public.regulations FOR
INSERT
WITH
    CHECK (auth.role () = 'service_role');

-- PROJECTS POLICIES
DROP POLICY IF EXISTS "projects_select_member" ON public.projects;

CREATE POLICY "projects_select_member" ON public.projects FOR SELECT USING (
    owner_id = auth.uid() OR team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;

CREATE POLICY "projects_insert_own" ON public.projects FOR
INSERT
WITH
    CHECK (owner_id = auth.uid ());

DROP POLICY IF EXISTS "projects_update_owner_manager" ON public.projects;

CREATE POLICY "projects_update_owner_manager" ON public.projects FOR UPDATE USING (
    owner_id = auth.uid()
    OR (
        team @> jsonb_build_array(jsonb_build_object('id', auth.uid()::TEXT))
        AND get_user_project_role(id) IN ('MANAGER')
    )
);

DROP POLICY IF EXISTS "projects_delete_owner" ON public.projects;

CREATE POLICY "projects_delete_owner" ON public.projects FOR DELETE USING (owner_id = auth.uid ());

-- TASKS POLICIES
DROP POLICY IF EXISTS "tasks_select_project_member" ON public.tasks;

CREATE POLICY "tasks_select_project_member" ON public.tasks FOR
SELECT USING (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "tasks_insert_owner_manager" ON public.tasks;

CREATE POLICY "tasks_insert_owner_manager" ON public.tasks FOR
INSERT
WITH
    CHECK (
        is_project_owner (project_id)
        OR get_user_project_role (project_id) = 'MANAGER'
    );

DROP POLICY IF EXISTS "tasks_update_project_member" ON public.tasks;

CREATE POLICY "tasks_update_project_member" ON public.tasks FOR
UPDATE USING (
    is_project_member (project_id)
);

DROP POLICY IF EXISTS "tasks_delete_owner_manager" ON public.tasks;

CREATE POLICY "tasks_delete_owner_manager" ON public.tasks FOR DELETE USING (
    is_project_owner (project_id)
    OR get_user_project_role (project_id) = 'MANAGER'
);

-- PURCHASES POLICIES
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

-- REMINDERS POLICIES
DROP POLICY IF EXISTS "reminders_project_member" ON public.reminders;

CREATE POLICY "reminders_project_member" ON public.reminders FOR ALL USING (
    is_project_member (project_id)
)
WITH
    CHECK (
        is_project_member (project_id)
    );

-- ACTIVITY LOG POLICIES
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

-- PUNCH LIST POLICIES
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

-- DOCUMENTS POLICIES
DROP POLICY IF EXISTS "documents_select_member" ON public.documents;

CREATE POLICY "documents_select_member" ON public.documents FOR
SELECT USING (
        is_project_member (project_id)
        AND (
            access_level = 'public_team'
            OR (
                access_level = 'managers_only'
                AND get_user_project_role (project_id) IN ('OWNER', 'MANAGER')
            )
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

-- TIME ENTRIES POLICIES
DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;

CREATE POLICY "time_entries_select" ON public.time_entries FOR
SELECT USING (
        is_project_member (project_id)
    );

DROP POLICY IF EXISTS "time_entries_insert_own" ON public.time_entries;

CREATE POLICY "time_entries_insert_own" ON public.time_entries FOR
INSERT
WITH
    CHECK (
        user_id = auth.uid ()
        AND is_project_member (project_id)
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

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;

CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (user_id = auth.uid ())
WITH
    CHECK (user_id = auth.uid ());

-- LOGS POLICIES
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
-- SECTION 18: REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

ALTER PUBLICATION supabase_realtime
ADD
TABLE public.punch_list_items;

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;

-- ============================================================
-- SECTION 20: VIEWS
-- ============================================================
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
-- DONE - Schema version 2.0.0
-- ============================================================