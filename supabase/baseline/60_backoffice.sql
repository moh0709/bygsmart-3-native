-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 60: Back-office (NOT syncable — network-required per PRD §6.2)
-- ============================================================================
-- No tombstone / no (updated_at,id) cursor / no soft-delete columns: these are
-- online-only surfaces (billing, org admin, promo codes, SMTP, AI, connections,
-- notifications, the append-only budget ledger). set_updated_at triggers are
-- kept where 2.1 maintained updated_at.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.1  notifications  (+ type/metadata; delivery webhook keys off `type`)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text        text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  is_read     boolean NOT NULL DEFAULT false,
  link        text,
  type        text NOT NULL DEFAULT 'info',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.2  notification_preferences  (default-on model: absence of row == both on)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key     text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled  boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences (user_id);
CREATE TRIGGER notif_prefs_set_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.3  push_subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);
CREATE TRIGGER push_subs_set_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.4  logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  level       public.log_level_type NOT NULL DEFAULT 'INFO',
  message     text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON public.logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level     ON public.logs (level);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.5  user_connections + connection_invites + connection_requests
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_connections (
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connected_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'EMPLOYEE',
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, connected_user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_connections_user ON public.user_connections (user_id);

CREATE TABLE IF NOT EXISTS public.connection_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_email text NOT NULL,
  role         text NOT NULL DEFAULT 'EMPLOYEE',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connection_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'EMPLOYEE',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.6  partner_negotiation_messages  (resource_id path only; legacy invite path dropped)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_negotiation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id     uuid NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'offer', 'accept', 'decline')),
  body            text,
  amount_ore      bigint,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pnm_resource ON public.partner_negotiation_messages (resource_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.7  member_terminations  (audit; service-role writes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_terminations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  removed_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  removed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_path     text,
  email_status    text CHECK (email_status IN ('sent', 'failed', 'skipped')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_terminations_project
  ON public.member_terminations (project_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.8  smtp_configs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.smtp_configs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope              text NOT NULL CHECK (scope IN ('global', 'custom')),
  owner_id           uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  host               text,
  port               integer,
  secure             boolean NOT NULL DEFAULT true,
  username           text,
  password_encrypted text,               -- AES-256-GCM ciphertext, never plaintext
  from_name          text,
  from_email         text,
  enabled            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS smtp_configs_global_unique ON public.smtp_configs (scope) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS smtp_configs_custom_owner_unique ON public.smtp_configs (owner_id) WHERE scope = 'custom';
CREATE TRIGGER smtp_configs_set_updated_at BEFORE UPDATE ON public.smtp_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.9  tool_access_configs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tool_access_configs (
  tool_id                 text PRIMARY KEY,
  access_level            text NOT NULL DEFAULT 'free' CHECK (access_level IN ('free', 'pro', 'campaign')),
  campaign_until          timestamptz,
  advanced_access_level   text NOT NULL DEFAULT 'inherit' CHECK (advanced_access_level IN ('free', 'pro', 'campaign', 'inherit')),
  advanced_campaign_until timestamptz,
  note                    text,
  updated_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tool_access_campaign_requires_date
    CHECK (access_level <> 'campaign' OR campaign_until IS NOT NULL),
  CONSTRAINT tool_access_advanced_campaign_requires_date
    CHECK (advanced_access_level <> 'campaign' OR advanced_campaign_until IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_tool_access_level ON public.tool_access_configs (access_level);
CREATE TRIGGER tool_access_set_updated_at BEFORE UPDATE ON public.tool_access_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.10  module_access_configs  (global per-module defaults / kill-switch)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_access_configs (
  module_id  text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT true,
  min_tier   public.subscription_tier,
  note       text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER module_access_set_updated_at BEFORE UPDATE ON public.module_access_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.11  org_module_prefs  (owner-level presentation deactivation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_module_prefs (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id  text NOT NULL,
  hidden     boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_omp_org ON public.org_module_prefs (org_id);
CREATE TRIGGER omp_set_updated_at BEFORE UPDATE ON public.org_module_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.12  org_storage_usage  (metering)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_storage_usage (
  org_id       uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  bytes_total  bigint NOT NULL DEFAULT 0,
  bytes_legacy bigint NOT NULL DEFAULT 0,
  object_count integer NOT NULL DEFAULT 0,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.13  ai_provider_configs + ai_usage_log + ai_handover_reports_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       text NOT NULL UNIQUE,
  enabled           boolean NOT NULL DEFAULT false,
  api_key_encrypted text,                 -- AES-256-GCM ciphertext
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_model     text,
  priority          integer NOT NULL DEFAULT 100,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_provider_enabled_priority ON public.ai_provider_configs (enabled, priority);
CREATE TRIGGER ai_provider_set_updated_at BEFORE UPDATE ON public.ai_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  model       text,
  feature     text,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tokens_in   integer,
  tokens_out  integer,
  latency_ms  integer,
  success     boolean NOT NULL DEFAULT false,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created  ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON public.ai_usage_log (provider_id);

CREATE TABLE IF NOT EXISTS public.ai_handover_reports_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_handover_log_project
  ON public.ai_handover_reports_log (project_id, generated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.14  trial_codes + demo_access_requests
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trial_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  trial_days      integer CHECK (trial_days IS NULL OR (trial_days BETWEEN 1 AND 365)),
  trial_until     timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count  integer NOT NULL DEFAULT 0,
  expires_at      timestamptz,
  active          boolean NOT NULL DEFAULT true,
  note            text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_codes_one_kind
    CHECK (((trial_days IS NOT NULL))::int + ((trial_until IS NOT NULL))::int = 1)
);

CREATE TABLE IF NOT EXISTS public.demo_access_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_email    text NOT NULL,
  contact_name     text,
  company_name     text,
  demo_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  demo_login_email text NOT NULL,
  user_agent       text,
  ip_address       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_email   ON public.demo_access_requests (contact_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created ON public.demo_access_requests (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 60.15  BUDGET LEDGER  (append-only; back-office, project-scoped, never synced)
--        Physical ON DELETE CASCADE from projects is the ONLY delete path; the
--        UNIFIED cascade-vs-guard rule (parent_is_gone) lets a ledger row go
--        exactly when its parent budget/revision/project is already gone, and
--        rejects every ad-hoc mutation otherwise.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_budgets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  status                  text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'approved')),
  total_kr                numeric(14,2) NOT NULL DEFAULT 0,
  labor_rate_dkk_per_hour numeric(10,2),
  currency                text NOT NULL DEFAULT 'DKK',
  created_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON public.project_budgets (project_id);

CREATE TABLE IF NOT EXISTS public.project_budget_categories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_budget_id uuid NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  category          text NOT NULL CHECK (category IN ('materials', 'labor', 'subcontractors', 'other')),
  amount_kr         numeric(14,2) NOT NULL DEFAULT 0,
  note              text,
  UNIQUE (project_budget_id, category)
);
CREATE INDEX IF NOT EXISTS idx_pbc_budget ON public.project_budget_categories (project_budget_id);

CREATE TABLE IF NOT EXISTS public.project_budget_revisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_budget_id uuid NOT NULL REFERENCES public.project_budgets(id) ON DELETE CASCADE,
  revision_number   integer NOT NULL,
  reason            text NOT NULL CHECK (length(trim(reason)) > 0),
  total_delta_kr    numeric(14,2) NOT NULL,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_budget_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_pbr_budget ON public.project_budget_revisions (project_budget_id, revision_number);

CREATE TABLE IF NOT EXISTS public.project_budget_revision_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.project_budget_revisions(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('materials', 'labor', 'subcontractors', 'other')),
  delta_kr    numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (revision_id, category)
);
CREATE INDEX IF NOT EXISTS idx_pbrc_revision ON public.project_budget_revision_categories (revision_id);

-- Baseline immutability: an approved baseline's frozen fields cannot change.
CREATE OR REPLACE FUNCTION public.protect_project_budget_baseline()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    NEW.total_kr := OLD.total_kr;
    NEW.status   := OLD.status;
    NEW.currency := OLD.currency;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_budgets_protect_baseline
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.protect_project_budget_baseline();
CREATE TRIGGER project_budgets_set_updated_at
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Append-only guard on the UNIFIED cascade-vs-guard rule. Rejects UPDATE always;
-- rejects ad-hoc DELETE; ALLOWS a DELETE when the row's own parent is already
-- gone (i.e. this DELETE is a cascade out of a dead budget/revision/project).
CREATE OR REPLACE FUNCTION public.reject_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'project_budget_revision_categories' THEN
      IF public.parent_is_gone('public.project_budget_revisions'::regclass, OLD.revision_id) THEN
        RETURN OLD;
      END IF;
    ELSE  -- project_budget_categories, project_budget_revisions
      IF public.parent_is_gone('public.project_budgets'::regclass, OLD.project_budget_id) THEN
        RETURN OLD;
      END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'Denne tabel er append-only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER pbc_immutable  BEFORE UPDATE OR DELETE ON public.project_budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();
CREATE TRIGGER pbr_immutable  BEFORE UPDATE OR DELETE ON public.project_budget_revisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();
CREATE TRIGGER pbrc_immutable BEFORE UPDATE OR DELETE ON public.project_budget_revision_categories
  FOR EACH ROW EXECUTE FUNCTION public.reject_ledger_mutation();
