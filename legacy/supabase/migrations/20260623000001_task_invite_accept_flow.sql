-- ============================================================
-- MIGRATION: Task-invite accept flow — consistent pending rule
--
-- 1. Fixes has_partner_task_access to require status='active'
--    (was: IN ('pending','active')) so pending partners cannot
--    read or update tasks they have a resource_task_access row
--    for but have not yet accepted.
--
-- 2. Adds accept_task_invite_notification() SECURITY DEFINER RPC
--    so the invitee can accept a task invite notification and
--    update (or create) their own project_resources row to
--    'active' without requiring manager-level privileges.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Update has_partner_task_access — require active only
-- ─────────────────────────────────────────────────────────────

-- This function is used by tasks_select_partner_access (SELECT
-- on tasks table). Changing pending→active ensures pending
-- invitees cannot see task rows until they accept.
CREATE OR REPLACE FUNCTION public.has_partner_task_access(p_task_id UUID)
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ─────────────────────────────────────────────────────────────
-- 2. accept_task_invite_notification — atomic accept RPC
-- ─────────────────────────────────────────────────────────────

-- Called by the invitee when they tap "Accepter" on a task_invite
-- notification. SECURITY DEFINER allows the invitee to upsert
-- their own project_resources row without manager-level rights.
--
-- Steps:
--   a. Validate notification belongs to caller and is type=task_invite.
--   b. Extract project_id, task_id, member_kind from notification.metadata.
--   c. If a project_resources row already exists for this project+user:
--        update status→active, stamp joined_at.
--      If no row exists:
--        insert a canonical row (profile-backed name/initials/email),
--        using member_kind from metadata to determine kind/visibility.
--   d. For partner rows: upsert resource_task_access for the invited task.
--   e. Mark the notification as read.

CREATE OR REPLACE FUNCTION public.accept_task_invite_notification(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller      UUID := auth.uid();
  v_notif       RECORD;
  v_meta        JSONB;
  v_project_id  UUID;
  v_task_id     UUID;
  v_member_kind TEXT;
  v_resource    RECORD;
  v_resource_id UUID;
  v_profile     RECORD;
  v_visibility  TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  -- Load and validate the notification
  SELECT id, user_id, type, metadata
  INTO v_notif
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notifikation ikke fundet' USING ERRCODE = '02000';
  END IF;

  IF v_notif.user_id <> v_caller THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  IF v_notif.type <> 'task_invite' THEN
    RAISE EXCEPTION 'Ugyldig notifikationstype' USING ERRCODE = '23514';
  END IF;

  -- Extract metadata
  v_meta        := v_notif.metadata;
  v_project_id  := (v_meta->>'project_id')::UUID;
  v_task_id     := CASE WHEN v_meta->>'task_id' IS NOT NULL
                        THEN (v_meta->>'task_id')::UUID
                        ELSE NULL END;
  v_member_kind := COALESCE(NULLIF(v_meta->>'member_kind', ''), 'partner');

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig notifikation metadata (mangler project_id)' USING ERRCODE = '23514';
  END IF;

  v_visibility := CASE WHEN v_member_kind = 'staff' THEN 'standard' ELSE 'none' END;

  -- Check for existing project_resources row
  SELECT id, kind
  INTO v_resource
  FROM public.project_resources
  WHERE project_id = v_project_id AND user_id = v_caller;

  IF FOUND THEN
    -- Row exists: activate it (idempotent)
    UPDATE public.project_resources
    SET status    = 'active',
        joined_at = COALESCE(joined_at, now())
    WHERE id = v_resource.id
      AND status <> 'active';

    v_resource_id := v_resource.id;

    -- Ensure resource_task_access exists for partner (defensive upsert)
    IF v_resource.kind = 'partner' AND v_task_id IS NOT NULL THEN
      INSERT INTO public.resource_task_access (resource_id, task_id)
      VALUES (v_resource_id, v_task_id)
      ON CONFLICT (resource_id, task_id) DO NOTHING;
    END IF;

  ELSE
    -- No row yet: create it with profile-backed identity
    SELECT name, initials, email
    INTO v_profile
    FROM public.profiles WHERE id = v_caller;

    INSERT INTO public.project_resources
      (project_id, user_id, name, initials, email,
       kind, visibility, status, joined_at)
    VALUES
      (v_project_id, v_caller,
       COALESCE(v_profile.name, 'Ukendt'),
       COALESCE(v_profile.initials, 'XX'),
       v_profile.email,
       v_member_kind, v_visibility,
       'active', now())
    RETURNING id INTO v_resource_id;

    -- For partner: create resource_task_access for the invited task
    IF v_member_kind = 'partner' AND v_task_id IS NOT NULL THEN
      INSERT INTO public.resource_task_access (resource_id, task_id)
      VALUES (v_resource_id, v_task_id)
      ON CONFLICT (resource_id, task_id) DO NOTHING;
    END IF;
  END IF;

  -- Mark notification read only after the membership update succeeds
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_task_invite_notification(UUID) TO authenticated;
