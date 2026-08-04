-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 30: Core project graph (SYNCABLE)
-- ============================================================================
-- projects, project_resources, resource_task_access, tasks, quick_task_access.
-- Every table: deleted_at + trigger updated_at + (updated_at,id) cursor +
-- emit_tombstone. Syncable child FKs keep ON DELETE CASCADE ONLY as the physical
-- purge / GDPR cleanup safety-net; the device-visible delete path is the soft
-- cascade wired at the bottom of each root.
--
-- Membership model (flagged, Req 5): project_resources is the SINGLE membership
-- source. The 2.1 projects.team[] JSONB mirror is DROPPED; RLS helpers in
-- 70_rls.sql read project_resources directly.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.1  projects
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id                     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_number             text,
  name                       text NOT NULL,
  client_name                text,
  status                     text NOT NULL DEFAULT 'I gang',
  progress                   integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date                 date,
  end_date                   date,
  address                    text,
  description                text,
  regulation_count           integer NOT NULL DEFAULT 0,
  checklist_count            integer NOT NULL DEFAULT 0,
  is_favorite                boolean NOT NULL DEFAULT false,
  floor_plan_url             text,
  milestone                  jsonb NOT NULL DEFAULT '{"title":"","dueDateRelative":""}'::jsonb,
  budget                     jsonb,                          -- planned-total mirror (ledger is authoritative)
  acceptance_report_settings jsonb,
  completed_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  deleted_at                 timestamptz
);
-- NOTE: 2.1's projects.team[] JSONB is intentionally REMOVED — project_resources
-- is the canonical membership table.

CREATE INDEX IF NOT EXISTS idx_projects_owner   ON public.projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_org     ON public.projects (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status  ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_sync    ON public.projects (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON public.projects (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_emit_tombstone
  AFTER UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- projects.org_id default — attach the creator's active org (membership-validated).
CREATE OR REPLACE FUNCTION public.projects_default_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(auth.uid(), NEW.owner_id);
  v_org  uuid;
BEGIN
  IF NEW.org_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = NEW.org_id AND m.user_id = auth.uid()
        AND m.status = 'active' AND m.deleted_at IS NULL
    ) THEN
      NEW.org_id := NULL;
    END IF;
  END IF;
  IF NEW.org_id IS NULL AND v_user IS NOT NULL THEN
    SELECT p.active_org_id INTO v_org FROM public.profiles p WHERE p.id = v_user;
    IF v_org IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_org AND m.user_id = v_user AND m.status = 'active' AND m.deleted_at IS NULL
    ) THEN
      NEW.org_id := v_org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_default_org
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_default_org();

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.2  project_resources  (canonical staff + partner membership)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,   -- physical-purge net
  user_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email            text,
  name             text NOT NULL,
  initials         text,
  kind             text NOT NULL CHECK (kind IN ('staff', 'partner')),
  visibility       text NOT NULL DEFAULT 'standard' CHECK (visibility IN ('all', 'some', 'standard', 'none')),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'cancelled')),
  agreed_price_ore bigint,
  currency         text NOT NULL DEFAULT 'DKK',
  settled_at       timestamptz,
  joined_at        timestamptz,
  invited_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_resources_project      ON public.project_resources (project_id);
CREATE INDEX IF NOT EXISTS idx_project_resources_user         ON public.project_resources (user_id);
CREATE INDEX IF NOT EXISTS idx_project_resources_project_kind ON public.project_resources (project_id, kind);
CREATE INDEX IF NOT EXISTS idx_project_resources_sync         ON public.project_resources (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_project_resources_deleted      ON public.project_resources (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER project_resources_set_updated_at
  BEFORE UPDATE ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_resources_emit_tombstone
  AFTER UPDATE OR DELETE ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.3  resource_task_access  (partner -> task allowlist)
--       2.1 had NO timestamps at all — added here for the cursor + tombstone.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_task_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  task_id     uuid NOT NULL,   -- FK to public.tasks added in 30.4b (tasks defined below)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (resource_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_rta_resource ON public.resource_task_access (resource_id);
CREATE INDEX IF NOT EXISTS idx_rta_task     ON public.resource_task_access (task_id);
CREATE INDEX IF NOT EXISTS idx_rta_sync     ON public.resource_task_access (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_rta_deleted  ON public.resource_task_access (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER rta_set_updated_at
  BEFORE UPDATE ON public.resource_task_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rta_emit_tombstone
  AFTER UPDATE OR DELETE ON public.resource_task_access
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- project_resources soft-delete cascade -> its allowlist + doc-visibility rows.
CREATE TRIGGER project_resources_cascade_rta
  AFTER UPDATE ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('resource_task_access', 'resource_id');
CREATE TRIGGER project_resources_cascade_docvis
  AFTER UPDATE ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('document_visibility', 'resource_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.4  tasks  (project OR quick scope; project_id nullable for quick tasks)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid REFERENCES public.projects(id) ON DELETE CASCADE,   -- nullable: quick tasks
  owner_id               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- quick-task owner
  scope                  text NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'quick')),
  title                  text NOT NULL,
  status                 text NOT NULL DEFAULT 'To Do',
  priority               text NOT NULL DEFAULT 'Mellem' CHECK (priority IN ('Høj', 'Mellem', 'Lav')),
  due_date               date,
  description            text,
  is_milestone           boolean NOT NULL DEFAULT false,
  estimated_hours        numeric(8,2) NOT NULL DEFAULT 0,
  step                   text,
  related_link           jsonb,
  assignees              jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist              jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments            jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments               jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_regulations  jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies           jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_tabs          text[] NOT NULL DEFAULT '{}',
  completed_at           timestamptz,
  acceptance_report_path text,
  handover_status        text NOT NULL DEFAULT 'none'
                         CHECK (handover_status IN ('none', 'draft', 'submitted', 'accepted', 'rejected')),
  archived_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
-- NOTE: 2.1's tasks.offers JSONB was dropped in the source history — not ported.

CREATE INDEX IF NOT EXISTS idx_tasks_project     ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_scope ON public.tasks (owner_id, scope);
CREATE INDEX IF NOT EXISTS idx_tasks_scope       ON public.tasks (scope);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees   ON public.tasks USING GIN (assignees);
CREATE INDEX IF NOT EXISTS idx_tasks_archived    ON public.tasks (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sync        ON public.tasks (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted     ON public.tasks (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_emit_tombstone
  AFTER UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- 30.4b  Deferred FK: resource_task_access.task_id -> tasks (tasks now exists).
ALTER TABLE public.resource_task_access
  ADD CONSTRAINT resource_task_access_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.5  quick_task_access  (projectless delegation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_task_access (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,   -- nullable: email invite
  invite_email text,
  invited_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role         text NOT NULL DEFAULT 'worker',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qta_task    ON public.quick_task_access (task_id);
CREATE INDEX IF NOT EXISTS idx_qta_user    ON public.quick_task_access (user_id);
CREATE INDEX IF NOT EXISTS idx_qta_sync    ON public.quick_task_access (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_qta_deleted ON public.quick_task_access (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER qta_set_updated_at
  BEFORE UPDATE ON public.quick_task_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER qta_emit_tombstone
  AFTER UPDATE OR DELETE ON public.quick_task_access
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 30.6  Soft-delete cascade wiring
--   projects -> direct project-scoped children  (tasks then cascade onward)
--   tasks    -> task-scoped children
--   (child tables live in 40/50; cascade_soft_delete resolves them dynamically.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER projects_cascade_tasks
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('tasks', 'project_id');
CREATE TRIGGER projects_cascade_resources
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('project_resources', 'project_id');
CREATE TRIGGER projects_cascade_purchases
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('purchases', 'project_id');
CREATE TRIGGER projects_cascade_reminders
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('reminders', 'project_id');
CREATE TRIGGER projects_cascade_activity
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('activity_log', 'project_id');
CREATE TRIGGER projects_cascade_documents
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('documents', 'project_id');
CREATE TRIGGER projects_cascade_layouts
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('punch_list_layouts', 'project_id');
CREATE TRIGGER projects_cascade_punch_items
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('punch_list_items', 'project_id');
CREATE TRIGGER projects_cascade_quotations
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('quotations', 'project_id');

CREATE TRIGGER tasks_cascade_checkins
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_check_ins', 'task_id');
CREATE TRIGGER tasks_cascade_docs
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_documentation', 'task_id');
CREATE TRIGGER tasks_cascade_handovers
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_handovers', 'task_id');
CREATE TRIGGER tasks_cascade_qc
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_quality_controls', 'task_id');
CREATE TRIGGER tasks_cascade_chat
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_chat_messages', 'task_id');
CREATE TRIGGER tasks_cascade_rta
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('resource_task_access', 'task_id');
CREATE TRIGGER tasks_cascade_qta
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('quick_task_access', 'task_id');
CREATE TRIGGER tasks_cascade_rates
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('task_budget_rates', 'task_id');
CREATE TRIGGER tasks_cascade_time
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('time_entries', 'task_id');
