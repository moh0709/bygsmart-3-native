-- Welcome email dedupe marker.
-- Set once (server-side) the first time a confirmed user triggers the welcome
-- email via POST /api/account/welcome, so it is never sent twice. Written only
-- by the API server (service role); no RLS policy change needed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;
