-- Demo onboarding details.
--
-- A demo visitor is asked for their name and company on the welcome step that
-- sits between "Demo adgang" and the app. The answers land on the profile
-- (profiles.name / profiles.company_name — both already exist and are what the
-- admin dashboard reads) and are mirrored onto the lead row so sales keeps the
-- context even after the demo profile is recycled or deleted.

ALTER TABLE public.demo_access_requests
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT;
