-- Production demo access and web push support.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_contact_email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo
  ON public.profiles (is_demo);

CREATE TABLE IF NOT EXISTS public.demo_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_email TEXT NOT NULL,
  demo_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  demo_login_email TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_access_requests_contact_email
  ON public.demo_access_requests (contact_email);

CREATE INDEX IF NOT EXISTS idx_demo_access_requests_created_at
  ON public.demo_access_requests (created_at DESC);

ALTER TABLE public.demo_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_access_service_role_only" ON public.demo_access_requests;
CREATE POLICY "demo_access_service_role_only"
  ON public.demo_access_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_select"
  ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_own_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own_delete"
  ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_service_role_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_service_role_all"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
