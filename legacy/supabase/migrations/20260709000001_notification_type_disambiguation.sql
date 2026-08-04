-- Notification type disambiguation for connection events.
--
-- send_connection_request / accept_connection_request originally inserted
-- notifications WITHOUT a `type`, so both fell back to the DB default 'info'
-- (shared with several unrelated events). The email/push delivery webhook keys
-- off `type`, so these are re-created to stamp distinct types:
--   send    → 'connection_request'
--   accept  → 'connection_accepted'
-- Bodies are otherwise identical to 20260607000001_connection_requests.sql.
-- CREATE OR REPLACE preserves existing privileges; GRANTs re-stated for safety.

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

  -- Send in-app notification to recipient (typed for email/push delivery)
  SELECT name INTO v_sender_name FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.notifications (user_id, text, link, type)
  VALUES (p_to_user_id,
          v_sender_name || ' har sendt dig en forbindelsesanmodning',
          '#/home',
          'connection_request');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_connection_request(UUID, TEXT) TO authenticated;


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

  -- Notify the original sender (typed for email/push delivery)
  SELECT name INTO v_acceptor_name FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.notifications (user_id, text, link, type)
  VALUES (v_req.from_user_id,
          v_acceptor_name || ' har accepteret din forbindelsesanmodning',
          '#/home',
          'connection_accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_connection_request(UUID) TO authenticated;
