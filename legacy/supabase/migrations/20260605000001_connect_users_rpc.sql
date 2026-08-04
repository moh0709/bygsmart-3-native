-- Supersedes the connect_users definition from 20260510000001.
-- Keeps the same idempotent CREATE OR REPLACE so it is safe to replay.
-- Role is normalised to EMPLOYEE for any unrecognised value; OWNER is
-- excluded to prevent privilege escalation via the RPC.

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
  v_caller  UUID;
  v_allowed TEXT[] := ARRAY['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'];
  v_role    TEXT;
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
