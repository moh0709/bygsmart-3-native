-- Phase 4: AI Orchestration — multi-provider configs + usage logging
-- Additive migration — adds two new tables, no changes to existing ones.
--
-- ENCRYPTION NOTE:
-- `ai_provider_configs.api_key_encrypted` never contains a plaintext key.
-- The API server (server/aiProviders.js) encrypts keys with AES-256-GCM
-- before insert. The 32-byte encryption key is derived via scrypt from the
-- AI_KEYS_SECRET environment variable (server-side only), and the stored
-- format is "base64(iv):base64(authTag):base64(ciphertext)". Keys are only
-- ever decrypted in server memory at invocation time and are never returned
-- by any API endpoint (admin endpoints expose hasKey + masked last4 only).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ai_provider_configs — one row per AI provider the admin has configured
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id        text NOT NULL UNIQUE,
    enabled            boolean NOT NULL DEFAULT false,
    api_key_encrypted  text,
    -- Provider-specific extras: endpoint, region, deployment, project_id,
    -- access key id, api version etc. Never secrets — those go in
    -- api_key_encrypted.
    config             jsonb NOT NULL DEFAULT '{}'::jsonb,
    default_model      text,
    -- Lower number = earlier in the fallback chain.
    priority           integer NOT NULL DEFAULT 100,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    updated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_enabled_priority
    ON public.ai_provider_configs(enabled, priority);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ai_usage_log — one row per AI invocation attempt (success or failure)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id  text NOT NULL,
    model        text,
    -- Which app feature triggered the call (briefing, onboarding, chat, ...).
    feature      text,
    user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    tokens_in    integer,
    tokens_out   integer,
    latency_ms   integer,
    success      boolean NOT NULL DEFAULT false,
    error        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at  ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_id ON public.ai_usage_log(provider_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — configs are admin-only; usage log is insert-via-service-role only
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log        ENABLE ROW LEVEL SECURITY;

-- Admins (profiles.app_role = 'admin') may read/write provider configs.
-- The API server uses the service role (bypasses RLS); this policy exists as
-- defence in depth for any direct client access.
CREATE POLICY "ai_provider_configs_admin_all" ON public.ai_provider_configs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    );

-- Usage log: admins can read. No INSERT/UPDATE/DELETE policies are created,
-- so writes are only possible via the service role (the API server).
CREATE POLICY "ai_usage_log_admin_select" ON public.ai_usage_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-update updated_at (reuses public.set_updated_at() from
--    20260606000000_admin_company_role.sql)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS ai_provider_configs_set_updated_at ON public.ai_provider_configs;
CREATE TRIGGER ai_provider_configs_set_updated_at
    BEFORE UPDATE ON public.ai_provider_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
