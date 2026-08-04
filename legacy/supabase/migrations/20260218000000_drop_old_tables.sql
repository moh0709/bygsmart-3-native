-- ============================================================
-- CLEANUP: Drop any existing tables from old/incomplete schema
-- to allow the full schema to be recreated cleanly.
-- This is safe on a fresh project with no real user data.
-- ============================================================

-- Drop in reverse dependency order (children before parents)
DROP TABLE IF EXISTS public.logs CASCADE;

DROP TABLE IF EXISTS public.notifications CASCADE;

DROP TABLE IF EXISTS public.time_entries CASCADE;

DROP TABLE IF EXISTS public.documents CASCADE;

DROP TABLE IF EXISTS public.punch_list_items CASCADE;

DROP TABLE IF EXISTS public.punch_list_layouts CASCADE;

DROP TABLE IF EXISTS public.activity_log CASCADE;

DROP TABLE IF EXISTS public.reminders CASCADE;

DROP TABLE IF EXISTS public.purchases CASCADE;

DROP TABLE IF EXISTS public.tasks CASCADE;

DROP TABLE IF EXISTS public.projects CASCADE;

DROP TABLE IF EXISTS public.regulations CASCADE;

-- Drop helper functions (will be recreated in sections_6_to_20)
DROP FUNCTION IF EXISTS public.is_project_member (UUID) CASCADE;

DROP FUNCTION IF EXISTS public.is_project_owner (UUID) CASCADE;

DROP FUNCTION IF EXISTS public.get_user_project_role (UUID) CASCADE;

DROP FUNCTION IF EXISTS public.cleanup_old_logs () CASCADE;

-- Drop view (will be recreated)
DROP VIEW IF EXISTS public.projects_summary CASCADE;