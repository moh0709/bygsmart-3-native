-- ============================================================
-- Connection Requests System
-- Adds a proper friend-request / pending-approval flow so that
-- users must consent before being linked as connections.
-- Also adds a SECURITY DEFINER search_users RPC so any
-- authenticated user can discover other users regardless of RLS.
-- Fixes the broken profiles_select_project_member policy.
-- ============================================================

-- ---- 1. connection_requests table --------------------------

CREATE TABLE IF NOT EXISTS public.connection_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'EMPLOYEE',
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Sender sees their own outgoing requests
DROP POLICY IF EXISTS "conn_req_select_sender"   ON public.connection_requests;
CREATE POLICY "conn_req_select_sender" ON public.connection_requests
  FOR SELECT TO authenticated USING (auth.uid() = from_user_id);

-- Receiver sees their own incoming requests
DROP POLICY IF EXISTS "conn_req_select_receiver" ON public.connection_requests;
CREATE POLICY "conn_req_select_receiver" ON public.connection_requests
  FOR SELECT TO authenticated USING (auth.uid() = to_user_id);

-- Only sender can insert
DROP POLICY IF EXISTS "conn_req_insert" ON public.connection_requests;
CREATE POLICY "conn_req_insert" ON public.connection_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

-- Only receiver can update (accept / reject)
DROP POLICY IF EXISTS "conn_req_update_receiver" ON public.connection_requests;
CREATE POLICY "conn_req_update_receiver" ON public.connection_requests
  FOR UPDATE TO authenticated USING (auth.uid() = to_user_id);

-- Sender can delete (cancel), receiver can delete (dismiss rejected)
DROP POLICY IF EXISTS "conn_req_delete" ON public.connection_requests;
CREATE POLICY "conn_req_delete" ON public.connection_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);


-- ---- 2. search_users RPC -----------------------------------
-- Bypasses RLS so any authenticated user can discover other
-- users by name / username. Only public fields are returned.

CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT)
RETURNS TABLE (id UUID, username TEXT, name TEXT, initials TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.username, p.name, p.initials
    FROM public.profiles p
    WHERE (p.name ILIKE '%' || p_query || '%'
        OR p.username ILIKE '%' || p_query || '%')
      AND p.id != auth.uid()
      AND p.is_demo = false
    ORDER BY p.name
    LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;


-- ---- 3. send_connection_request RPC ------------------------

CREATE OR REPLACE FUNCTION public.send_connection_request(
  p_to_user_id UUID,
  p_role       TEXT DEFAULT 'EMPLOYEE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  UUID  := auth.uid();
  v_allowed TEXT[] := ARRAY['MANAGER','EMPLOYEE','EXTERNAL','CLIENT'];
  v_role    TEXT;
  v_sender_name TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke autoriseret' USING ERRCODE = '42501';
  END IF;
  IF v_caller = p_to_user_id THEN
    RAISE EXCEPTION 'Kan ikke sende anmodning til dig selv' USING ERRCODE = '23514';
  END IF;

  -- Check no active connection already exists
  IF EXISTS (
    SELECT 1 FROM public.user_connections
    WHERE user_id = v_caller AND connected_user_id = p_to_user_id
  ) THEN
    RAISE EXCEPTION 'Allerede forbundet' USING ERRCODE = '23505';
  END IF;

  v_role := CASE WHEN p_role = ANY(v_allowed) THEN p_role ELSE 'EMPLOYEE' END;

  INSERT INTO public.connection_requests (from_user_id, to_user_id, role)
  VALUES (v_caller, p_to_user_id, v_role)
  ON CONFLICT (from_user_id, to_user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'pending', created_at = now();

  -- Send in-app notification to recipient
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.notifications (user_id, text, link)
  VALUES (p_to_user_id,
          v_sender_name || ' har sendt dig en forbindelsesanmodning',
          '#/home');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_connection_request(UUID, TEXT) TO authenticated;


-- ---- 4. get_pending_connection_requests RPC ----------------
-- Returns incoming pending requests with sender profile fields.
-- SECURITY DEFINER so the join on profiles bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_pending_connection_requests()
RETURNS TABLE (
  request_id   UUID,
  from_user_id UUID,
  username     TEXT,
  name         TEXT,
  initials     TEXT,
  role         TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT cr.id, cr.from_user_id, p.username, p.name, p.initials,
           cr.role, cr.created_at
    FROM public.connection_requests cr
    JOIN public.profiles p ON p.id = cr.from_user_id
    WHERE cr.to_user_id = auth.uid()
      AND cr.status = 'pending'
    ORDER BY cr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_connection_requests() TO authenticated;


-- ---- 5. accept_connection_request RPC ----------------------

CREATE OR REPLACE FUNCTION public.accept_connection_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req    public.connection_requests%ROWTYPE;
  v_acceptor_name TEXT;
BEGIN
  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
    AND to_user_id = v_caller
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anmodning ikke fundet' USING ERRCODE = '02000';
  END IF;

  UPDATE public.connection_requests SET status = 'accepted' WHERE id = p_request_id;

  -- Create bidirectional connection
  INSERT INTO public.user_connections (user_id, connected_user_id, role)
  VALUES (v_req.from_user_id, v_caller, v_req.role)
  ON CONFLICT (user_id, connected_user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.user_connections (user_id, connected_user_id, role)
  VALUES (v_caller, v_req.from_user_id, v_req.role)
  ON CONFLICT (user_id, connected_user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Notify the original sender
  SELECT name INTO v_acceptor_name FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.notifications (user_id, text, link)
  VALUES (v_req.from_user_id,
          v_acceptor_name || ' har accepteret din forbindelsesanmodning',
          '#/home');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_connection_request(UUID) TO authenticated;


-- ---- 6. reject_connection_request RPC ----------------------

CREATE OR REPLACE FUNCTION public.reject_connection_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  DELETE FROM public.connection_requests
  WHERE id = p_request_id
    AND to_user_id = v_caller
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anmodning ikke fundet' USING ERRCODE = '02000';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_connection_request(UUID) TO authenticated;


-- ---- 7. Fix broken profiles_select_project_member policy ---
-- The old policy used p.id (project uuid) instead of id (profiles.id)
-- in the JSONB team-member check, so it never matched.

DROP POLICY IF EXISTS "profiles_select_project_member" ON public.profiles;

CREATE POLICY "profiles_select_project_member" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.owner_id = auth.uid()
         OR p.team @> jsonb_build_array(jsonb_build_object('id', id::text))
    )
  );
