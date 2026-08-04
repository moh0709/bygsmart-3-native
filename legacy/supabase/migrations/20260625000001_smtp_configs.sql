-- Phase 5: SMTP Configuration — per-scope email transport settings
-- Additive migration — adds one new table, no changes to existing ones.
--
-- ENCRYPTION NOTE:
-- `smtp_configs.password_encrypted` never contains a plaintext password.
-- The API server (server/email.js) encrypts passwords with AES-256-GCM
-- before insert, reusing the same AI_KEYS_SECRET / encryptApiKey helper from
-- server/aiProviders.js. The stored format is
-- "base64(iv):base64(authTag):base64(ciphertext)". Passwords are only ever
-- decrypted in server memory at send/verify time and are never returned by any
-- API endpoint (admin endpoints expose hasPassword: bool only).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. smtp_configs — one row for the global config, one per premium owner
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.smtp_configs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope               text NOT NULL CHECK (scope IN ('global', 'custom')),
    owner_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    host                text,
    port                integer,
    secure              boolean NOT NULL DEFAULT true,
    username            text,
    password_encrypted  text,
    from_name           text,
    from_email          text,
    enabled             boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Exactly one global row.
CREATE UNIQUE INDEX IF NOT EXISTS smtp_configs_global_unique
    ON public.smtp_configs (scope)
    WHERE scope = 'global';

-- One custom row per owner.
CREATE UNIQUE INDEX IF NOT EXISTS smtp_configs_custom_owner_unique
    ON public.smtp_configs (owner_id)
    WHERE scope = 'custom';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;

-- Admins (profiles.app_role = 'admin') may read the global row.
-- The API server uses the service role (bypasses RLS); this policy exists as
-- defence in depth for any direct client access.
CREATE POLICY "smtp_configs_admin_all" ON public.smtp_configs
    FOR ALL
    USING (
        scope = 'global'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    )
    WITH CHECK (
        scope = 'global'
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    );

-- Subscription owners may read/write their own custom row.
-- Writes are also guarded server-side (subscription tier + team_role checks).
CREATE POLICY "smtp_configs_owner_own" ON public.smtp_configs
    FOR ALL
    USING (owner_id = auth.uid() AND scope = 'custom')
    WITH CHECK (owner_id = auth.uid() AND scope = 'custom');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-update updated_at (reuses public.set_updated_at() from
--    20260606000000_admin_company_role.sql)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS smtp_configs_set_updated_at ON public.smtp_configs;
CREATE TRIGGER smtp_configs_set_updated_at
    BEFORE UPDATE ON public.smtp_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
