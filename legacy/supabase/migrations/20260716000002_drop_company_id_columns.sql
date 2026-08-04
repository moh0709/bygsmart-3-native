-- W7e follow-up (pre-announced in 20260716000001): drop the orphan
-- company_id columns now that all clients run bundles that no longer
-- select them. Both columns verified all-NULL immediately before applying.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.projects DROP COLUMN IF EXISTS company_id;
