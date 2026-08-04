-- ============================================================
-- pgTAP regression test for F-02: profiles RLS over-exposure
-- Run with:  supabase test db
-- ============================================================
-- Proves:
--   (a) a project owner CAN read their own profile and the profiles of
--       teammates on a shared project;
--   (b) a project owner CANNOT read an unrelated user's profile (the leak);
--   (c) connected-user and own-profile visibility still work;
--   (d) an unrelated owner cannot read the first owner's profile.
--
-- All seeding runs as the (superuser) test role; assertions run after
-- SET ROLE authenticated + a forged JWT, so RLS is actually enforced.

BEGIN;

-- Make the suite self-contained: ensure pgTAP is available and on the search
-- path so the unqualified plan()/is()/finish() calls resolve under `supabase
-- test db` regardless of where the extension was installed.
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path TO public, extensions;

SELECT plan(8);

-- ── Fixtures ────────────────────────────────────────────────
-- Stable UUIDs:
--   A = owner of the shared project P
--   B = teammate listed in P.team
--   C = unrelated owner of project Q (shares nothing with A)
--   D = a user connected to A via user_connections (no shared project)
-- Inserting into auth.users fires handle_new_user(), which creates the
-- matching public.profiles rows automatically.
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'rls_a@test.dev', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'rls_b@test.dev', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'rls_c@test.dev', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'rls_d@test.dev', '{}'::jsonb, '{}'::jsonb, now(), now());

-- Project P: owned by A, team contains B.
INSERT INTO public.projects (id, owner_id, name, team)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Shared project',
  jsonb_build_array(jsonb_build_object('id', '22222222-2222-2222-2222-222222222222', 'role', 'EMPLOYEE'))
);

-- Project Q: owned by C, shares nothing with A.
INSERT INTO public.projects (id, owner_id, name, team)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '33333333-3333-3333-3333-333333333333',
  'Unrelated project',
  '[]'::jsonb
);

-- A is connected to D (peer connection, not a shared project).
INSERT INTO public.user_connections (user_id, connected_user_id)
VALUES ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');

-- ── Caller = A (project owner) ──────────────────────────────
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

-- (c) own profile visible
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111')::int,
  1,
  'owner A can read their own profile'
);

-- (a) teammate on shared project visible
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222')::int,
  1,
  'owner A can read teammate B on a shared project'
);

-- (b) THE LEAK: unrelated profile must NOT be visible
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333')::int,
  0,
  'owner A CANNOT read unrelated user C (F-02 over-exposure is closed)'
);

-- (c) connected user still visible (separate connected policy)
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444')::int,
  1,
  'owner A can read connected user D'
);

-- Anti-over-exposure: of the four test users, A sees exactly three (A, B, D) — not C.
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222',
     '33333333-3333-3333-3333-333333333333',
     '44444444-4444-4444-4444-444444444444'
   ))::int,
  3,
  'owner A sees only own + teammate + connection, never the unrelated profile'
);

RESET ROLE;

-- ── Caller = C (unrelated owner) ────────────────────────────
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

-- (b) symmetric: C cannot read A
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111')::int,
  0,
  'unrelated owner C CANNOT read owner A'
);

-- C cannot read B either (B shares a project only with A)
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222')::int,
  0,
  'unrelated owner C CANNOT read teammate B of a foreign project'
);

-- (c) C can still read their own profile
SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333')::int,
  1,
  'owner C can read their own profile'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
