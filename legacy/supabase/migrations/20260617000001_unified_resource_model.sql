-- ============================================================
-- MIGRATION: T1 — Unified Ressource Model (Staff/Partner)
-- Collapses projects.team[] JSONB and project_partners into a
-- single canonical project_resources table, generalized
-- resource_task_access (replacing partner_task_access as
-- authoritative), and re-points all negotiation + RLS helpers.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_resources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id          uuid        NULL        REFERENCES public.profiles(id) ON DELETE CASCADE,
  email            text        NULL,
  name             text        NOT NULL,
  initials         text,
  kind             text        NOT NULL CHECK (kind IN ('staff','partner')),
  visibility       text        NOT NULL DEFAULT 'standard'
                               CHECK (visibility IN ('all','some','standard','none')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','active','declined','cancelled')),
  agreed_price_ore bigint      NULL,
  currency         text        NOT NULL DEFAULT 'DKK',
  settled_at       timestamptz NULL,
  joined_at        timestamptz NULL,
  invited_by       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  message          text        NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_resources_project
  ON public.project_resources(project_id);
CREATE INDEX IF NOT EXISTS idx_project_resources_user
  ON public.project_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_project_resources_project_kind
  ON public.project_resources(project_id, kind);

CREATE OR REPLACE TRIGGER project_resources_updated_at
  BEFORE UPDATE ON public.project_resources
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- resource_task_access: generalised allowlist (replaces the
-- partner-only partner_task_access as the canonical table).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resource_task_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.project_resources(id) ON DELETE CASCADE,
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  UNIQUE (resource_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_task_access_resource
  ON public.resource_task_access(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_task_access_task
  ON public.resource_task_access(task_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Backfill project_resources from projects.team (staff)
-- ─────────────────────────────────────────────────────────────

-- CTE derives the UUID exactly once per row (after the regex guard),
-- so the subsequent profile-existence check reuses the pre-cast value
-- instead of repeating (m->>'id')::uuid inside EXISTS.
WITH safe_staff AS (
  SELECT
    p.id                                                    AS project_id,
    (m->>'id')::uuid                                        AS user_id,
    m->>'email'                                             AS email,
    COALESCE(NULLIF(m->>'name',''), 'Ukendt')              AS name,
    COALESCE(NULLIF(m->>'initials',''), 'XX')              AS initials,
    CASE WHEN (m->>'role') IN ('OWNER','MANAGER') THEN 'all'
         ELSE 'standard' END                                AS visibility,
    CASE WHEN (m->>'status') = 'ACTIVE' THEN 'active'
         ELSE 'pending' END                                 AS status,
    CASE
      WHEN (m->>'joinedAt') ~ '^\d{4}-\d{2}-\d{2}'
      THEN (m->>'joinedAt')::timestamptz
      ELSE NULL
    END                                                     AS joined_at
  FROM public.projects p
  CROSS JOIN jsonb_array_elements(p.team) AS m
  WHERE (m->>'id') IS NOT NULL
    AND (m->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
INSERT INTO public.project_resources
  (project_id, user_id, email, name, initials, kind, visibility, status, joined_at)
SELECT
  ss.project_id, ss.user_id, ss.email, ss.name, ss.initials,
  'staff', ss.visibility, ss.status, ss.joined_at
FROM safe_staff ss
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = ss.user_id)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill project_resources from project_partners (partner)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.project_resources
  (project_id, user_id, name, initials, kind, visibility, status,
   agreed_price_ore, currency, settled_at, joined_at,
   invited_by, message, created_at, updated_at)
SELECT
  pp.project_id,
  pp.partner_id,
  COALESCE(pr.name, 'Underleverandør'),
  COALESCE(pr.initials, '?'),
  'partner',
  'none',
  CASE pp.status
    WHEN 'accepted'    THEN 'active'
    WHEN 'declined'    THEN 'declined'
    WHEN 'cancelled'   THEN 'cancelled'
    ELSE 'pending'
  END,
  pp.agreed_price_ore,
  pp.currency,
  pp.settled_at,
  pp.created_at,
  pp.invited_by,
  pp.message,
  pp.created_at,
  pp.updated_at
FROM public.project_partners pp
LEFT JOIN public.profiles pr ON pr.id = pp.partner_id
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill resource_task_access from partner_task_access
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.resource_task_access (resource_id, task_id)
SELECT res.id, pta.task_id
FROM public.partner_task_access pta
JOIN public.project_partners pp ON pp.id = pta.partner_invite_id
JOIN public.project_resources res
  ON res.project_id = pp.project_id
  AND res.user_id   = pp.partner_id
  AND res.kind      = 'partner'
ON CONFLICT (resource_id, task_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. Add resource_id to partner_negotiation_messages
--    and make partner_invite_id nullable (new rows use resource_id)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.partner_negotiation_messages
  ADD COLUMN IF NOT EXISTS resource_id uuid
    REFERENCES public.project_resources(id) ON DELETE CASCADE;

ALTER TABLE public.partner_negotiation_messages
  ALTER COLUMN partner_invite_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_messages_resource
  ON public.partner_negotiation_messages(resource_id, created_at);

-- Backfill resource_id for existing messages
UPDATE public.partner_negotiation_messages pnm
SET resource_id = res.id
FROM public.project_partners pp
JOIN public.project_resources res
  ON res.project_id = pp.project_id
  AND res.user_id   = pp.partner_id
  AND res.kind      = 'partner'
WHERE pnm.partner_invite_id = pp.id
  AND pnm.resource_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS helper functions (updated to use project_resources)
-- ─────────────────────────────────────────────────────────────

-- Legacy helper: used by RLS on messages that still carry
-- partner_invite_id (messages created before this migration).
CREATE OR REPLACE FUNCTION public.is_partner_invite_party_legacy(p_invite_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_partners pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = p_invite_id
      AND (p.owner_id = auth.uid()
           OR pp.invited_by = auth.uid()
           OR pp.partner_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Manager: project owner, inviter, or project manager.
CREATE OR REPLACE FUNCTION public.is_partner_invite_manager(p_resource_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources pr
    JOIN public.projects p ON p.id = pr.project_id
    WHERE pr.id = p_resource_id
      AND (p.owner_id = auth.uid()
           OR pr.invited_by = auth.uid()
           OR public.get_user_project_role(pr.project_id) = 'MANAGER')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Party: manager OR the resource's own user.
CREATE OR REPLACE FUNCTION public.is_partner_invite_party(p_resource_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_partner_invite_manager(p_resource_id)
      OR EXISTS (
           SELECT 1 FROM public.project_resources pr
           WHERE pr.id = p_resource_id AND pr.user_id = auth.uid()
         );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Partner task access via resource_task_access (canonical).
-- Requires status='active': pending invitees have a resource_task_access
-- allowlist row created eagerly at invite time, but RLS blocks actual access
-- until the invite is accepted (status transitions to 'active').
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
-- 7. RLS — project_resources
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_resources_select"         ON public.project_resources;
DROP POLICY IF EXISTS "project_resources_insert_manager" ON public.project_resources;
DROP POLICY IF EXISTS "project_resources_update_manager" ON public.project_resources;
DROP POLICY IF EXISTS "project_resources_update_self"    ON public.project_resources;
DROP POLICY IF EXISTS "project_resources_delete_manager" ON public.project_resources;

CREATE POLICY "project_resources_select" ON public.project_resources
  FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_member(project_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "project_resources_insert_manager" ON public.project_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
  );

CREATE POLICY "project_resources_update_manager" ON public.project_resources
  FOR UPDATE TO authenticated
  USING   (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER')
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

CREATE POLICY "project_resources_update_self" ON public.project_resources
  FOR UPDATE TO authenticated
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_resources_delete_manager" ON public.project_resources
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — resource_task_access
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.resource_task_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_task_access_select_party"   ON public.resource_task_access;
DROP POLICY IF EXISTS "resource_task_access_insert_manager" ON public.resource_task_access;
DROP POLICY IF EXISTS "resource_task_access_delete_manager" ON public.resource_task_access;

CREATE POLICY "resource_task_access_select_party" ON public.resource_task_access
  FOR SELECT TO authenticated
  USING (public.is_partner_invite_party(resource_id));

CREATE POLICY "resource_task_access_insert_manager" ON public.resource_task_access
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_partner_invite_manager(resource_id)
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_resources pr ON pr.id = resource_id
      WHERE t.id = task_id AND t.project_id = pr.project_id
    )
  );

CREATE POLICY "resource_task_access_delete_manager" ON public.resource_task_access
  FOR DELETE TO authenticated
  USING (public.is_partner_invite_manager(resource_id));

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — partner_negotiation_messages (updated)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "partner_messages_select_party" ON public.partner_negotiation_messages;
DROP POLICY IF EXISTS "partner_messages_insert_party" ON public.partner_negotiation_messages;

CREATE POLICY "partner_messages_select_party" ON public.partner_negotiation_messages
  FOR SELECT TO authenticated
  USING (
    (resource_id IS NOT NULL AND public.is_partner_invite_party(resource_id))
    OR (resource_id IS NULL
        AND partner_invite_id IS NOT NULL
        AND public.is_partner_invite_party_legacy(partner_invite_id))
  );

CREATE POLICY "partner_messages_insert_party" ON public.partner_negotiation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (resource_id IS NOT NULL
        AND public.is_partner_invite_party(resource_id)
        AND EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.id = resource_id AND pr.status IN ('pending','active')
        ))
      OR
      (resource_id IS NULL
        AND partner_invite_id IS NOT NULL
        AND public.is_partner_invite_party_legacy(partner_invite_id)
        AND EXISTS (
          SELECT 1 FROM public.project_partners pp
          WHERE pp.id = partner_invite_id AND pp.status IN ('invited','negotiating','accepted')
        ))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 10. RLS — tasks (updated to use resource_task_access)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select_partner_access"  ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_partner_accepted" ON public.tasks;

CREATE POLICY "tasks_select_partner_access" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.has_partner_task_access(id));

CREATE POLICY "tasks_update_partner_accepted" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.resource_task_access rta
      JOIN public.project_resources pr ON pr.id = rta.resource_id
      WHERE rta.task_id = tasks.id
        AND pr.user_id = auth.uid()
        AND pr.kind    = 'partner'
        AND pr.status  = 'active'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Updated RPCs
-- ─────────────────────────────────────────────────────────────

-- get_partner_project_view: check project_resources instead of project_partners
CREATE OR REPLACE FUNCTION public.get_partner_project_view(p_project_id UUID)
RETURNS TABLE (id UUID, name TEXT, description TEXT, deadline DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.name, p.description, p.end_date
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_project_member(p_project_id)
        OR EXISTS (
          SELECT 1 FROM public.project_resources pr
          WHERE pr.project_id = p.id
            AND pr.user_id    = auth.uid()
            AND pr.kind       = 'partner'
            AND pr.status    IN ('pending','active')
        )
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_project_view(UUID) TO authenticated;

-- get_my_partner_invites: query project_resources (kind='partner')
CREATE OR REPLACE FUNCTION public.get_my_partner_invites()
RETURNS TABLE (
  invite_id        UUID,
  project_id       UUID,
  project_name     TEXT,
  project_deadline DATE,
  invited_by       UUID,
  inviter_name     TEXT,
  inviter_initials TEXT,
  status           TEXT,
  agreed_price_ore BIGINT,
  currency         TEXT,
  message          TEXT,
  task_count       BIGINT,
  created_at       TIMESTAMPTZ,
  settled_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      pr.id,
      pr.project_id,
      p.name,
      p.end_date,
      pr.invited_by,
      prof.name,
      prof.initials,
      pr.status,
      pr.agreed_price_ore,
      pr.currency,
      pr.message,
      (SELECT COUNT(*) FROM public.resource_task_access rta WHERE rta.resource_id = pr.id),
      pr.created_at,
      pr.settled_at
    FROM public.project_resources pr
    JOIN public.projects p ON p.id = pr.project_id
    LEFT JOIN public.profiles prof ON prof.id = pr.invited_by
    WHERE pr.user_id = auth.uid()
      AND pr.kind    = 'partner'
    ORDER BY pr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_partner_invites() TO authenticated;

-- invite_partner: atomic upsert into project_resources + resource_task_access
CREATE OR REPLACE FUNCTION public.invite_partner(
  p_project_id        UUID,
  p_partner_id        UUID,
  p_task_ids          UUID[],
  p_message           TEXT   DEFAULT NULL,
  p_opening_price_ore BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller           UUID := auth.uid();
  v_project          public.projects%ROWTYPE;
  v_resource_id      UUID;
  v_caller_name      TEXT;
  v_partner_name     TEXT;
  v_partner_initials TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projekt ikke fundet' USING ERRCODE = '02000';
  END IF;

  IF NOT (v_project.owner_id = v_caller
          OR public.get_user_project_role(p_project_id) = 'MANAGER') THEN
    RAISE EXCEPTION 'Kun projektejer eller manager kan invitere partnere'
      USING ERRCODE = '42501';
  END IF;

  IF p_partner_id = v_caller THEN
    RAISE EXCEPTION 'Du kan ikke invitere dig selv' USING ERRCODE = '23514';
  END IF;

  IF p_task_ids IS NULL OR array_length(p_task_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Vælg mindst én opgave' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_resources
    WHERE project_id = p_project_id AND user_id = p_partner_id
      AND kind = 'partner' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Partneren er allerede tilknyttet projektet'
      USING ERRCODE = '23505';
  END IF;

  SELECT name, initials
  INTO v_partner_name, v_partner_initials
  FROM public.profiles WHERE id = p_partner_id;

  INSERT INTO public.project_resources
    (project_id, user_id, name, initials, kind, visibility, status, currency, invited_by, message)
  VALUES
    (p_project_id, p_partner_id,
     COALESCE(v_partner_name, 'Underleverandør'),
     COALESCE(v_partner_initials, '?'),
     'partner', 'none', 'pending', 'DKK', v_caller, p_message)
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET status           = 'pending',
        invited_by       = EXCLUDED.invited_by,
        message          = EXCLUDED.message,
        agreed_price_ore = NULL,
        settled_at       = NULL,
        updated_at       = now()
  RETURNING id INTO v_resource_id;

  -- Replace task allowlist
  DELETE FROM public.resource_task_access WHERE resource_id = v_resource_id;
  INSERT INTO public.resource_task_access (resource_id, task_id)
  SELECT v_resource_id, t.id
  FROM public.tasks t
  WHERE t.id = ANY(p_task_ids) AND t.project_id = p_project_id
  ON CONFLICT (resource_id, task_id) DO NOTHING;

  -- Opening message / offer
  IF p_message IS NOT NULL AND length(trim(p_message)) > 0 THEN
    INSERT INTO public.partner_negotiation_messages (resource_id, sender_id, kind, body)
    VALUES (v_resource_id, v_caller, 'message', p_message);
  END IF;

  IF p_opening_price_ore IS NOT NULL AND p_opening_price_ore > 0 THEN
    INSERT INTO public.partner_negotiation_messages (resource_id, sender_id, kind, body, amount_ore)
    VALUES (v_resource_id, v_caller, 'offer', 'Åbningstilbud', p_opening_price_ore);
  END IF;

  -- Notify partner
  SELECT name INTO v_caller_name FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.notifications (user_id, text, link, type, metadata)
  VALUES (
    p_partner_id,
    COALESCE(v_caller_name, 'En projektleder')
      || ' har inviteret dig som underleverandør på projektet "' || v_project.name || '"',
    '#/partner-project/' || p_project_id,
    'partner_invite',
    jsonb_build_object(
      'resource_id', v_resource_id,
      'invite_id',   v_resource_id,
      'project_id',  p_project_id
    )
  );

  RETURN v_resource_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_partner(UUID, UUID, UUID[], TEXT, BIGINT) TO authenticated;

-- accept_partner_invite: settle on project_resources row
CREATE OR REPLACE FUNCTION public.accept_partner_invite(
  p_invite_id        UUID,
  p_agreed_price_ore BIGINT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_resource     public.project_resources%ROWTYPE;
  v_is_manager   BOOLEAN;
  v_other_party  UUID;
  v_caller_name  TEXT;
  v_project_name TEXT;
BEGIN
  SELECT * INTO v_resource FROM public.project_resources WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
  END IF;

  v_is_manager := public.is_partner_invite_manager(p_invite_id);

  IF NOT (v_is_manager OR v_resource.user_id = v_caller) THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  IF v_resource.status != 'pending' THEN
    RAISE EXCEPTION 'Invitationen kan ikke længere accepteres' USING ERRCODE = '23514';
  END IF;

  IF p_agreed_price_ore IS NULL OR p_agreed_price_ore <= 0 THEN
    RAISE EXCEPTION 'Ugyldig aftalt pris' USING ERRCODE = '23514';
  END IF;

  UPDATE public.project_resources
  SET status           = 'active',
      agreed_price_ore = p_agreed_price_ore,
      settled_at       = now()
  WHERE id = p_invite_id;

  INSERT INTO public.partner_negotiation_messages
    (resource_id, sender_id, kind, body, amount_ore)
  VALUES (p_invite_id, v_caller, 'accept', 'Tilbud accepteret', p_agreed_price_ore);

  v_other_party := CASE
    WHEN v_caller = v_resource.user_id THEN v_resource.invited_by
    ELSE v_resource.user_id
  END;
  SELECT name INTO v_caller_name  FROM public.profiles WHERE id = v_caller;
  SELECT name INTO v_project_name FROM public.projects WHERE id = v_resource.project_id;

  INSERT INTO public.notifications (user_id, text, link, type, metadata)
  VALUES (
    v_other_party,
    COALESCE(v_caller_name, 'Modparten')
      || ' har accepteret aftalen på "' || COALESCE(v_project_name, 'projektet')
      || '" til ' || to_char(p_agreed_price_ore / 100.0, 'FM999G999G990D00')
      || ' ' || v_resource.currency,
    '#/partner-project/' || v_resource.project_id,
    'partner_invite_accepted',
    jsonb_build_object(
      'resource_id',      p_invite_id,
      'invite_id',        p_invite_id,
      'project_id',       v_resource.project_id,
      'agreed_price_ore', p_agreed_price_ore
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_partner_invite(UUID, BIGINT) TO authenticated;

-- decline_partner_invite
CREATE OR REPLACE FUNCTION public.decline_partner_invite(p_invite_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_resource     public.project_resources%ROWTYPE;
  v_caller_name  TEXT;
  v_project_name TEXT;
BEGIN
  SELECT * INTO v_resource
  FROM public.project_resources
  WHERE id = p_invite_id AND user_id = v_caller AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation ikke fundet' USING ERRCODE = '02000';
  END IF;

  UPDATE public.project_resources SET status = 'declined' WHERE id = p_invite_id;

  INSERT INTO public.partner_negotiation_messages (resource_id, sender_id, kind, body)
  VALUES (p_invite_id, v_caller, 'decline', 'Invitation afvist');

  SELECT name INTO v_caller_name  FROM public.profiles WHERE id = v_caller;
  SELECT name INTO v_project_name FROM public.projects WHERE id = v_resource.project_id;

  INSERT INTO public.notifications (user_id, text, link, type, metadata)
  VALUES (
    v_resource.invited_by,
    COALESCE(v_caller_name, 'Partneren')
      || ' har afvist din partnerinvitation på "'
      || COALESCE(v_project_name, 'projektet') || '"',
    '#/project-detail/' || v_resource.project_id,
    'partner_invite_declined',
    jsonb_build_object(
      'resource_id', p_invite_id,
      'invite_id',   p_invite_id,
      'project_id',  v_resource.project_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_partner_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 12. Realtime
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'project_resources'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_resources;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'resource_task_access'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_task_access;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 13. projects.team mirror trigger
--     Fires AFTER backfill to avoid row-by-row churn during
--     the INSERT statements above.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_projects_team_mirror()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);

  -- Only sync when the changed resource is kind='staff'
  IF COALESCE(NEW.kind, OLD.kind) != 'staff' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.projects p
  SET team = (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',       pr.user_id::text,
        'name',     pr.name,
        'initials', COALESCE(pr.initials, ''),
        'email',    pr.email,
        'role',     CASE
                      WHEN p2.owner_id = pr.user_id THEN 'OWNER'
                      WHEN pr.visibility = 'all'    THEN 'MANAGER'
                      ELSE 'EMPLOYEE'
                    END,
        'status',   CASE WHEN pr.status = 'active' THEN 'ACTIVE' ELSE 'PENDING' END,
        'joinedAt', COALESCE(pr.joined_at, pr.created_at)::text
      ) ORDER BY pr.created_at
    ), '[]'::jsonb)
    FROM public.project_resources pr
    JOIN public.projects p2 ON p2.id = pr.project_id
    WHERE pr.project_id = v_project_id
      AND pr.kind       = 'staff'
      AND pr.user_id    IS NOT NULL
  )
  WHERE id = v_project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_resources_team_mirror ON public.project_resources;

CREATE TRIGGER project_resources_team_mirror
  AFTER INSERT OR UPDATE OR DELETE ON public.project_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_projects_team_mirror();
