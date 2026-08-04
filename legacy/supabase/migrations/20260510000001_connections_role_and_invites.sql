-- P1.1: Add role column to user_connections and create connection_invites table.
-- Additive migration — safe to run multiple times.

ALTER TABLE public.user_connections
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'EMPLOYEE';

CREATE TABLE IF NOT EXISTS public.connection_invites (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_email TEXT         NOT NULL,
  role         TEXT         NOT NULL DEFAULT 'EMPLOYEE',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'connection_invites' AND policyname = 'invites_insert_own'
  ) THEN
    CREATE POLICY "invites_insert_own" ON public.connection_invites
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = inviter_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'connection_invites' AND policyname = 'invites_select_own'
  ) THEN
    CREATE POLICY "invites_select_own" ON public.connection_invites
      FOR SELECT TO authenticated
      USING (auth.uid() = inviter_id);
  END IF;
END $$;

-- RPC: connect_users
-- Upserts both directions of a user connection in a SECURITY DEFINER context so
-- the reverse row (target → caller) can bypass the RLS policy that restricts
-- direct inserts to rows where user_id = auth.uid().
-- OWNER is excluded from the allowed set to prevent privilege escalation.
-- Unsupported roles are silently normalised to EMPLOYEE.
CREATE OR REPLACE FUNCTION public.connect_users(
  p_connected_user_id UUID,
  p_role             TEXT DEFAULT 'EMPLOYEE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       UUID;
  v_allowed      TEXT[] := ARRAY['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'];
  v_role         TEXT;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;

  IF p_connected_user_id IS NULL THEN
    RAISE EXCEPTION 'p_connected_user_id must not be null' USING ERRCODE = '22023';
  END IF;

  IF v_caller = p_connected_user_id THEN
    RAISE EXCEPTION 'Kan ikke forbinde til dig selv' USING ERRCODE = '23514';
  END IF;

  -- Default to EMPLOYEE for any unrecognised or disallowed role value.
  v_role := CASE WHEN p_role = ANY(v_allowed) THEN p_role ELSE 'EMPLOYEE' END;

  -- Upsert initiator → target
  INSERT INTO public.user_connections (user_id, connected_user_id, role)
  VALUES (v_caller, p_connected_user_id, v_role)
  ON CONFLICT (user_id, connected_user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Upsert target → initiator (bidirectional)
  INSERT INTO public.user_connections (user_id, connected_user_id, role)
  VALUES (p_connected_user_id, v_caller, v_role)
  ON CONFLICT (user_id, connected_user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_users(UUID, TEXT) TO authenticated;
