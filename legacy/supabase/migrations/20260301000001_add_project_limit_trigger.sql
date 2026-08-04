-- Enforce subscription plan project limits server-side at database level.

CREATE OR REPLACE FUNCTION public.check_project_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier subscription_tier;
  project_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT subscription_tier
  INTO user_tier
  FROM public.profiles
  WHERE id = NEW.owner_id;

  SELECT COUNT(*)
  INTO project_count
  FROM public.projects
  WHERE owner_id = NEW.owner_id
    AND COALESCE(status, '') NOT IN ('ARCHIVED', 'Afsluttet');

  max_allowed := CASE user_tier
    WHEN 'FREE' THEN 1
    WHEN 'PRO' THEN 5
    WHEN 'PREMIUM' THEN 1000
    WHEN 'ENTERPRISE' THEN 10000
    ELSE 1
  END;

  IF project_count >= max_allowed THEN
    RAISE EXCEPTION 'Project limit reached for plan %', user_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_project_limit ON public.projects;

CREATE TRIGGER enforce_project_limit
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.check_project_limit();

-- AI quota checks are done in server/index.js. Add index used by quota logic.
CREATE INDEX IF NOT EXISTS idx_profiles_ai_reset ON public.profiles (ai_last_reset_date);

-- Prevent users from changing their own subscription tier directly.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND subscription_tier = (
    SELECT p.subscription_tier
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);