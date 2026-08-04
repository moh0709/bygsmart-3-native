-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 20: Identity & organisation (FK roots)
-- ============================================================================
-- profiles, organizations, organization_members, org_module_entitlements.
-- These are SYNCABLE (mirrored per PRD R1) — full offline treatment:
-- deleted_at + trigger-maintained updated_at + (updated_at,id) cursor + tombstone.
--
-- Divergence from 2.1 (flagged in README): the legacy teams / team_seats billing
-- vehicle is NOT ported, so organization_members is the SINGLE source of truth
-- for membership (2.1 mirrored it from team_seats). profiles loses team_id /
-- team_role / company_id accordingly, and handle_new_user() is simplified to the
-- personal-org path with no team-seat reconciliation.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 20.1  profiles  (1:1 with auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username               text UNIQUE NOT NULL,
  name                   text NOT NULL DEFAULT '',
  initials               text NOT NULL DEFAULT '',
  email                  text,
  avatar_url             text,
  subscription_tier      public.subscription_tier NOT NULL DEFAULT 'FREE',
  ai_requests_today      integer NOT NULL DEFAULT 0,
  ai_last_reset_date     date,
  stripe_customer_id     text,
  stripe_subscription_id text,
  -- account-level platform role (distinct from project-scoped role)
  app_role               text NOT NULL DEFAULT 'user',
  -- Stripe test-vs-live classifier (service-role settable only)
  user_type              text NOT NULL DEFAULT 'normal'
                         CHECK (user_type IN ('normal', 'test', 'partner', 'admin')),
  -- profile detail fields (freely self-editable)
  company_name           text,
  cvr                    text,
  address                text,
  phone                  text,
  job_title              text,
  -- multi-org tenancy (FK added after organizations exists — see 20.2b; the
  -- profiles <-> organizations reference is mutually circular)
  active_org_id          uuid,
  -- demo + lifecycle
  is_demo                boolean NOT NULL DEFAULT false,
  demo_contact_email     text,
  welcomed_at            timestamptz,
  trial_reminded_at      timestamptz,
  -- admin-granted trial OVERLAY (never writes subscription_tier)
  trial_tier             text CHECK (trial_tier IS NULL OR trial_tier IN ('PRO', 'PREMIUM', 'ENTERPRISE')),
  trial_ends_at          timestamptz,
  trial_granted_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  trial_granted_at       timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_profiles_username     ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_app_role     ON public.profiles (app_role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type    ON public.profiles (user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_is_demo      ON public.profiles (is_demo);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends   ON public.profiles (trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_sync         ON public.profiles (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted      ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_emit_tombstone
  AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- Column guard: freeze privileged/service-role-only columns against end-user
-- self-writes (the profiles_update_own policy is USING(id=auth.uid()) with no
-- column-level restriction, so this trigger is the column guard). Service-role
-- writes run with auth.uid() IS NULL and pass through untouched.
-- Re-derived from 2.1 protect_trial_columns() MINUS the retired team_id /
-- company_id branches.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.trial_tier         := OLD.trial_tier;
    NEW.trial_ends_at      := OLD.trial_ends_at;
    NEW.trial_granted_by   := OLD.trial_granted_by;
    NEW.trial_granted_at   := OLD.trial_granted_at;
    NEW.app_role           := OLD.app_role;
    NEW.user_type          := OLD.user_type;
    NEW.is_demo            := OLD.is_demo;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    -- active_org_id only moves through set_active_org() (membership-validated).
    IF current_setting('app.privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
      NEW.active_org_id := OLD.active_org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 20.2  organizations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  cvr                    text,
  address                text,
  logo_url               text,
  created_by             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grandfathered          boolean NOT NULL DEFAULT false,   -- marketplace default = lean
  storage_allowance_gb   integer NOT NULL DEFAULT 5,
  storage_subscription_id text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
-- NOTE (flagged): 2.1's source_team_id / source_company_id backfill-idempotency
-- columns are DROPPED — they only exist to reconcile the retired teams/companies
-- tables, which the baseline does not resurrect.

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_sync       ON public.organizations (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted    ON public.organizations (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organizations_emit_tombstone
  AFTER UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- 20.2b  Close the circular profiles <-> organizations reference now that both
--        tables exist.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_active_org_fkey
  FOREIGN KEY (active_org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_org ON public.profiles (active_org_id) WHERE active_org_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 20.3  organization_members  (SINGLE source of truth for membership)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_email text,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  invited_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),   -- 2.1 had none; needed for the cursor
  deleted_at   timestamptz,
  CONSTRAINT om_user_or_email CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS om_org_user_unique
  ON public.organization_members (org_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS om_org_email_unique
  ON public.organization_members (org_id, invite_email) WHERE invite_email IS NOT NULL AND user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_om_user    ON public.organization_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_om_org     ON public.organization_members (org_id);
CREATE INDEX IF NOT EXISTS idx_om_sync    ON public.organization_members (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_om_deleted ON public.organization_members (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER organization_members_set_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organization_members_emit_tombstone
  AFTER UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.emit_tombstone();

-- Last-owner integrity guard, re-derived onto the UNIFIED cascade-vs-guard rule
-- (parent_is_gone). Fires on demotion/removal AND soft delete. Allows the row to
-- go when the org or the member is already gone (account deletion / GDPR /
-- cascade); otherwise an org must keep >= 1 active owner.
CREATE OR REPLACE FUNCTION public.protect_last_org_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_becoming_dead boolean;
BEGIN
  -- Cascade / erasure, not a demotion: org or member already gone -> release it.
  IF public.parent_is_gone('public.organizations'::regclass, OLD.org_id)
     OR public.parent_is_gone('public.profiles'::regclass, OLD.user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Is this operation removing the owner (delete, soft-delete, demote, deactivate)?
  v_becoming_dead := (TG_OP = 'DELETE')
                     OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
                     OR (NEW.role <> 'owner')
                     OR (NEW.status <> 'active');

  IF OLD.role = 'owner' AND OLD.status = 'active' AND OLD.deleted_at IS NULL
     AND v_becoming_dead
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = OLD.org_id AND role = 'owner' AND status = 'active'
         AND deleted_at IS NULL AND id <> OLD.id
     ) THEN
    RAISE EXCEPTION 'En organisation skal have mindst én aktiv ejer.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER organization_members_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_org_owner();

-- ─────────────────────────────────────────────────────────────────────────────
-- 20.4  org_module_entitlements  (per-org module overrides; entitlement cache)
--       Syncable-READ only: written by the service role (admin/Stripe), members
--       SELECT their own org's rows. Client keeps a 72-hour TTL cache (S-15),
--       independent of the 14-day session grace.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_module_entitlements (
  org_id                      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id                   text NOT NULL,
  status                      text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled', 'trial')),
  source                      text NOT NULL DEFAULT 'admin' CHECK (source IN ('tier', 'purchase', 'trial', 'admin')),
  valid_until                 timestamptz,
  stripe_subscription_item_id text,
  stripe_subscription_id      text,
  cancel_at_period_end        boolean NOT NULL DEFAULT false,
  current_period_end          timestamptz,
  note                        text,
  updated_by                  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_ome_org  ON public.org_module_entitlements (org_id);
CREATE INDEX IF NOT EXISTS idx_ome_sync ON public.org_module_entitlements (updated_at, org_id, module_id);

CREATE TRIGGER org_module_entitlements_set_updated_at
  BEFORE UPDATE ON public.org_module_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Composite-PK entitlement cache: no tombstone trigger — deletion is derived
-- from the org tombstone; entitlement disable is a status change, not a delete.

-- ─────────────────────────────────────────────────────────────────────────────
-- 20.5  New-user bootstrap  (simplified: no team-seat reconciliation)
--       Creates the profile, links pending org email invites, guarantees a
--       personal (lean) organisation, points active_org_id at the best org.
--       Fully guarded so an org bug can never block signup.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username_val text;
  org_id_val   uuid;
BEGIN
  username_val := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 1000)::text
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

  -- Reconcile pending quick_task_access email invites (link to the new account).
  UPDATE public.quick_task_access
  SET user_id = NEW.id
  WHERE invite_email IS NOT NULL AND user_id IS NULL
    AND LOWER(invite_email) = LOWER(NEW.email);

  -- Organisations: link email invites, guarantee a personal org. Fully guarded.
  BEGIN
    UPDATE public.organization_members
    SET user_id = NEW.id, status = 'active', accepted_at = now()
    WHERE invite_email IS NOT NULL AND user_id IS NULL
      AND LOWER(invite_email) = LOWER(NEW.email);

    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = NEW.id AND m.status = 'active' AND m.deleted_at IS NULL
    ) THEN
      INSERT INTO public.organizations (name, created_by, grandfathered)
      VALUES (COALESCE(NEW.raw_user_meta_data->>'name', username_val) || 's organisation', NEW.id, false)
      RETURNING id INTO org_id_val;

      INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
      VALUES (org_id_val, NEW.id, 'owner', 'active', now());
    END IF;

    UPDATE public.profiles
    SET active_org_id = (
      SELECT m.org_id FROM public.organization_members m
      WHERE m.user_id = NEW.id AND m.status = 'active' AND m.deleted_at IS NULL
      ORDER BY m.created_at
      LIMIT 1
    )
    WHERE id = NEW.id AND active_org_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- never block signup on org reconciliation
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
