-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 40: Field work, quality, chat, time, purchases (SYNCABLE)
-- ============================================================================
-- Full offline treatment on every id-PK table: deleted_at + trigger updated_at +
-- (updated_at,id) cursor + emit_tombstone. task_chat_reads is a private per-user
-- read cursor (composite PK) — updated_at only, no tombstone (device-local state).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.1  task_check_ins  (GPS check-in/out; THE canonical missing-updated_at bug)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_check_ins (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id) ON DELETE CASCADE,   -- nullable: quick tasks
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name        text NOT NULL DEFAULT '',
  checked_in_at    timestamptz NOT NULL DEFAULT now(),
  checked_out_at   timestamptz,
  checkin_lat      numeric(9,6),
  checkin_lng      numeric(9,6),
  checkin_accuracy numeric(10,2),
  auto_closed      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),   -- 2.1 had none -> cursor missed check-outs
  deleted_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_check_ins_one_active_per_user
  ON public.task_check_ins (user_id) WHERE checked_out_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_check_ins_task    ON public.task_check_ins (task_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_check_ins_user    ON public.task_check_ins (user_id);
CREATE INDEX IF NOT EXISTS idx_task_check_ins_sync    ON public.task_check_ins (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_task_check_ins_deleted ON public.task_check_ins (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER task_check_ins_set_updated_at BEFORE UPDATE ON public.task_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_check_ins_emit_tombstone AFTER UPDATE OR DELETE ON public.task_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.2  task_documentation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_documentation (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name  text NOT NULL DEFAULT '',
  kind         text NOT NULL DEFAULT 'text'
               CHECK (kind IN ('text', 'photo', 'audio', 'link', 'file', 'report')),
  body         text,
  storage_path text,
  mime_type    text,
  size_bytes   bigint,
  is_pinned    boolean NOT NULL DEFAULT false,
  comments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_doc_task    ON public.task_documentation (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_doc_pinned  ON public.task_documentation (task_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_doc_author  ON public.task_documentation (author_id);
CREATE INDEX IF NOT EXISTS idx_task_doc_sync    ON public.task_documentation (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_task_doc_deleted ON public.task_documentation (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER task_doc_set_updated_at BEFORE UPDATE ON public.task_documentation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_doc_emit_tombstone AFTER UPDATE OR DELETE ON public.task_documentation
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.3  task_handovers  (two-party accept flow + state-transition guard)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_handovers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                 uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id              uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  supplier_signature_path text,
  status                  text NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'accepted', 'rejected')),
  reviewed_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  mester_signature_path   text,
  rejection_reason        text,
  snags                   jsonb,
  report_path             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_handovers_task    ON public.task_handovers (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_handovers_sub     ON public.task_handovers (submitted_by);
CREATE INDEX IF NOT EXISTS idx_task_handovers_sync    ON public.task_handovers (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_task_handovers_deleted ON public.task_handovers (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER task_handovers_set_updated_at BEFORE UPDATE ON public.task_handovers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_handovers_emit_tombstone AFTER UPDATE OR DELETE ON public.task_handovers
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- Worker/manager transition guard (ported verbatim intent from 2.1).
CREATE OR REPLACE FUNCTION public.guard_task_handover_op()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT project_id INTO v_project_id FROM public.tasks WHERE id = NEW.task_id;

  IF public.is_project_owner(v_project_id)
     OR public.get_user_project_role(v_project_id) = 'MANAGER' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'submitted' THEN
      RAISE EXCEPTION 'Handover kan kun oprettes med status submitted' USING ERRCODE = '23514';
    END IF;
    IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.mester_signature_path IS NOT NULL OR NEW.rejection_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Kun projektejer eller manager kan sætte reviewfelter' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Allow a worker to soft-delete their own row (deleted_at transition only).
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
    -- Worker may re-submit a rejected handover.
    IF OLD.status = 'rejected' AND NEW.status = 'submitted' THEN
      IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
         OR NEW.task_id IS DISTINCT FROM OLD.task_id THEN
        RAISE EXCEPTION 'Kun projektejeren eller manager kan ændre disse felter' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.task_id IS DISTINCT FROM OLD.task_id THEN
      RAISE EXCEPTION 'Kun projektejeren eller manager kan ændre disse felter' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Ugyldig statusændring på overdragelse' USING ERRCODE = '23514';
    END IF;
    IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      RAISE EXCEPTION 'Kun projektejer eller manager kan sætte reviewfelter' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_handovers_guard_op
  BEFORE INSERT OR UPDATE ON public.task_handovers
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_handover_op();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.4  task_quality_controls  (KS checklist)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_quality_controls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id            uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name           text NOT NULL DEFAULT '',
  control_point         text,
  control_type          text CHECK (control_type IN ('visuel', 'maaling', 'dokumentation')),
  requirement_ref       text,
  result                text CHECK (result IN ('godkendt', 'ikke_godkendt')),
  comments              text,
  has_deviation         boolean NOT NULL DEFAULT false,
  deviation_description text,
  deviation_photos      jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrective_action     text,
  deviation_deadline    date,
  responsible_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsible_name      text,
  signature_path        text,
  control_date          date NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
-- NOTE: 2.1 declared author_id/responsible_id FKs with no ON DELETE; hardened to
-- CASCADE (author) / SET NULL (responsible) for explicit referential behaviour.
CREATE INDEX IF NOT EXISTS idx_task_qc_task    ON public.task_quality_controls (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_qc_author  ON public.task_quality_controls (author_id);
CREATE INDEX IF NOT EXISTS idx_task_qc_sync    ON public.task_quality_controls (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_task_qc_deleted ON public.task_quality_controls (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER task_qc_set_updated_at BEFORE UPDATE ON public.task_quality_controls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_qc_emit_tombstone AFTER UPDATE OR DELETE ON public.task_quality_controls
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.5  task_chat_messages  (+ project/task consistency guard)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name     text NOT NULL DEFAULT '',
  body            text,
  attachment_path text,
  attachment_mime text,
  mentions        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_chat_task    ON public.task_chat_messages (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_chat_sender  ON public.task_chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_task_chat_sync    ON public.task_chat_messages (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_task_chat_deleted ON public.task_chat_messages (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER task_chat_set_updated_at BEFORE UPDATE ON public.task_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER task_chat_emit_tombstone AFTER UPDATE OR DELETE ON public.task_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

CREATE OR REPLACE FUNCTION public.enforce_task_chat_project()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = NEW.task_id AND t.project_id IS NOT DISTINCT FROM NEW.project_id
  ) THEN
    RAISE EXCEPTION 'task_chat_messages project_id must match tasks.project_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_chat_project_guard
  BEFORE INSERT OR UPDATE OF task_id, project_id ON public.task_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_chat_project();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.6  task_chat_reads  (private per-user read cursor; composite PK, no tombstone)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_chat_reads (
  task_id      uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_chat_reads_user ON public.task_chat_reads (user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_chat_reads_sync ON public.task_chat_reads (updated_at, task_id, user_id);

CREATE TRIGGER task_chat_reads_set_updated_at BEFORE UPDATE ON public.task_chat_reads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.7  punch_list_layouts + punch_list_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.punch_list_layouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  reference  text,
  file_url   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_punch_layouts_project ON public.punch_list_layouts (project_id);
CREATE INDEX IF NOT EXISTS idx_punch_layouts_sync    ON public.punch_list_layouts (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_punch_layouts_deleted ON public.punch_list_layouts (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER punch_layouts_set_updated_at BEFORE UPDATE ON public.punch_list_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER punch_layouts_emit_tombstone AFTER UPDATE OR DELETE ON public.punch_list_layouts
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();
CREATE TRIGGER punch_layouts_cascade_items AFTER UPDATE ON public.punch_list_layouts
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('punch_list_items', 'layout_id');

CREATE TABLE IF NOT EXISTS public.punch_list_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  layout_id           uuid NOT NULL REFERENCES public.punch_list_layouts(id) ON DELETE CASCADE,
  photo_url           text,
  pin                 jsonb NOT NULL DEFAULT '{"x":50,"y":50}'::jsonb,
  description         text NOT NULL,
  status              text NOT NULL DEFAULT 'Åben',
  resolution_due_date date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_punch_items_project ON public.punch_list_items (project_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_layout  ON public.punch_list_items (layout_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_status  ON public.punch_list_items (status);
CREATE INDEX IF NOT EXISTS idx_punch_items_sync    ON public.punch_list_items (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_punch_items_deleted ON public.punch_list_items (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER punch_items_set_updated_at BEFORE UPDATE ON public.punch_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER punch_items_emit_tombstone AFTER UPDATE OR DELETE ON public.punch_list_items
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.8  purchases
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  details                text,
  quantity               numeric(12,3) NOT NULL DEFAULT 1,
  price                  numeric(12,2) NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'Afventer',
  supplier               text,
  item_number            text,
  attachment             jsonb,
  expected_delivery_date date,
  task_id                uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  assignee_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE INDEX IF NOT EXISTS idx_purchases_project ON public.purchases (project_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status  ON public.purchases (status);
CREATE INDEX IF NOT EXISTS idx_purchases_sync    ON public.purchases (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_purchases_deleted ON public.purchases (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER purchases_set_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER purchases_emit_tombstone AFTER UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.9  reminders
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        text NOT NULL,
  date_time    timestamptz NOT NULL,
  context      text,
  is_completed boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reminders_project ON public.reminders (project_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date    ON public.reminders (date_time);
CREATE INDEX IF NOT EXISTS idx_reminders_sync    ON public.reminders (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_reminders_deleted ON public.reminders (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER reminders_set_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER reminders_emit_tombstone AFTER UPDATE OR DELETE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.10  activity_log  (append-only feed, still soft-deletable via project cascade)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type        text NOT NULL,
  user_name   text NOT NULL,
  description text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),   -- 2.1 had timestamp only
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_activity_project ON public.activity_log (project_id);
CREATE INDEX IF NOT EXISTS idx_activity_ts      ON public.activity_log ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_activity_sync    ON public.activity_log (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_activity_deleted ON public.activity_log (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER activity_set_updated_at BEFORE UPDATE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activity_emit_tombstone AFTER UPDATE OR DELETE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.11  time_entries  (per-task hours; materialised from time_registrations)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE,   -- nullable: quick-task time
  task_id         uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name       text NOT NULL,
  hours           numeric(6,2) NOT NULL CHECK (hours > 0),
  date            date NOT NULL,
  description     text,
  registration_id uuid,   -- FK to time_registrations added in 40.12b (defined below)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON public.time_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user    ON public.time_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date    ON public.time_entries (date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_reg     ON public.time_entries (registration_id) WHERE registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_sync    ON public.time_entries (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_time_entries_deleted ON public.time_entries (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER time_entries_set_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER time_entries_emit_tombstone AFTER UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.12  time_registrations  (weekly org time model) + workflow guard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_registrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start       date NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_minutes    integer NOT NULL DEFAULT 0,
  responsible_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at     timestamptz,
  decided_at       timestamptz,
  decided_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision_comment text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (org_id, user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_time_reg_responsible ON public.time_registrations (responsible_id, week_start);
CREATE INDEX IF NOT EXISTS idx_time_reg_org_week    ON public.time_registrations (org_id, week_start);
CREATE INDEX IF NOT EXISTS idx_time_reg_sync        ON public.time_registrations (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_time_reg_deleted     ON public.time_registrations (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER time_reg_emit_tombstone AFTER UPDATE OR DELETE ON public.time_registrations
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- Workflow column guard (also maintains updated_at — replaces the 2.1 inline
-- assignment, folded into the unified pattern). Status/decision columns move only
-- through the submit/approve/reject RPCs (GUC opt-in), ported separately.
CREATE OR REPLACE FUNCTION public.protect_time_registration_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.time_registration_rpc', true), '') <> 'on' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.total_minutes IS DISTINCT FROM OLD.total_minutes
       OR NEW.responsible_id IS DISTINCT FROM OLD.responsible_id
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
       OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
       OR NEW.decision_comment IS DISTINCT FROM OLD.decision_comment THEN
      RAISE EXCEPTION 'Statusændringer sker via indsend/godkend/afvis.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER time_reg_protect_workflow
  BEFORE UPDATE ON public.time_registrations
  FOR EACH ROW EXECUTE FUNCTION public.protect_time_registration_workflow();

-- 40.12b  Deferred FK: time_entries.registration_id -> time_registrations.
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_registration_id_fkey
  FOREIGN KEY (registration_id) REFERENCES public.time_registrations(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.13  org_time_responsibles  (CEO -> approver mapping; composite PK, no tombstone)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_time_responsibles (
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staff_user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  responsible_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, staff_user_id)
);
CREATE INDEX IF NOT EXISTS idx_otr_responsible ON public.org_time_responsibles (responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_otr_sync        ON public.org_time_responsibles (updated_at, org_id, staff_user_id);

CREATE TRIGGER otr_set_updated_at BEFORE UPDATE ON public.org_time_responsibles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.14  quotations + quotation_line_items  (syncable-read; writes owner/manager)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number      text NOT NULL,
  title       text NOT NULL,
  client_name text,
  status      text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
  currency    text NOT NULL DEFAULT 'DKK',
  vat_rate    numeric(5,2) NOT NULL DEFAULT 25,
  valid_until date,
  notes       text,
  subtotal    numeric(14,2) NOT NULL DEFAULT 0,
  vat_total   numeric(14,2) NOT NULL DEFAULT 0,
  total       numeric(14,2) NOT NULL DEFAULT 0,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_quotations_project ON public.quotations (project_id);
CREATE INDEX IF NOT EXISTS idx_quotations_sync    ON public.quotations (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_quotations_deleted ON public.quotations (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER quotations_set_updated_at BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quotations_emit_tombstone AFTER UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();
CREATE TRIGGER quotations_cascade_items AFTER UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete('quotation_line_items', 'quotation_id');

CREATE TABLE IF NOT EXISTS public.quotation_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'MATERIAL' CHECK (kind IN ('MATERIAL', 'LABOR', 'OTHER')),
  description  text NOT NULL,
  quantity     numeric(14,4) NOT NULL DEFAULT 1,
  unit         text,
  unit_price   numeric(14,2) NOT NULL DEFAULT 0,
  line_total   numeric(14,2) NOT NULL DEFAULT 0,
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),   -- 2.1 had created_at only
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_qli_quotation ON public.quotation_line_items (quotation_id);
CREATE INDEX IF NOT EXISTS idx_qli_sync      ON public.quotation_line_items (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_qli_deleted   ON public.quotation_line_items (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER qli_set_updated_at BEFORE UPDATE ON public.quotation_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER qli_emit_tombstone AFTER UPDATE OR DELETE ON public.quotation_line_items
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- ─────────────────────────────────────────────────────────────────────────────
-- 40.15  task_budget_rates  (per-task rate override; money-sensitive, RPC writes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_budget_rates (
  task_id         uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hourly_rate_dkk numeric(10,2) NOT NULL,
  updated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_budget_rates_project ON public.task_budget_rates (project_id);
CREATE INDEX IF NOT EXISTS idx_task_budget_rates_sync    ON public.task_budget_rates (updated_at, task_id);
-- PK is task_id (uuid) — emit_tombstone reads it as entity_id.

CREATE TRIGGER task_budget_rates_set_updated_at BEFORE UPDATE ON public.task_budget_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
