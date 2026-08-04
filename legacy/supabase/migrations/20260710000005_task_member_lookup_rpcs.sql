-- ============================================================
-- MIGRATION: exact-match user lookup by phone/email, for the
-- Team-tab "+" invite flow (find an existing account before
-- falling back to an email invite with no account yet).
--
-- Exact match only, at most one row, no ILIKE/fuzzy search —
-- a directory-style search would leak the user list; this only
-- confirms/denies a specific phone number or email the caller
-- already typed in.
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_user_by_phone(p_phone TEXT)
RETURNS TABLE(id UUID, name TEXT, initials TEXT) AS $$
    SELECT id, name, initials
    FROM public.profiles
    WHERE phone IS NOT NULL
      AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
      AND regexp_replace(p_phone, '\D', '', 'g') <> ''
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, name TEXT, initials TEXT) AS $$
    SELECT id, name, initials
    FROM public.profiles
    WHERE email IS NOT NULL
      AND lower(email) = lower(p_email)
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.find_user_by_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(TEXT) TO authenticated;
