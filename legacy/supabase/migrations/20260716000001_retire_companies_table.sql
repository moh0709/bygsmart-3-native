-- Retire the legacy companies table (Phase 7 W7e — BYG 3.0 modularization).
--
-- organizations (Phase 2, 20260713000001) replaced the company concept.
-- At retirement time the table was EMPTY: 0 rows, 0 profiles.company_id,
-- 0 projects.company_id — verified 2026-07-11 before applying. No code reads
-- the table as of the W7e part-1 deploy (admin companies routes/tab removed,
-- AuthProvider/GodkendModal read profiles.company_name + profiles.cvr).
--
-- Schema at drop time (for the record):
--   companies(id uuid PK, name text NOT NULL, cvr text, address text,
--             logo_url text, owner_id uuid → profiles ON DELETE SET NULL,
--             created_at timestamptz, updated_at timestamptz)
--
-- profiles.company_id and projects.company_id COLUMNS are deliberately KEPT
-- (all NULL, FKs dropped) so clients running pre-W7e bundles that still
-- select company_id keep working. Drop the two columns in a later cleanup
-- once all sessions have cycled onto the new bundle.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_company_id_fkey;
DROP TABLE IF EXISTS public.companies;
