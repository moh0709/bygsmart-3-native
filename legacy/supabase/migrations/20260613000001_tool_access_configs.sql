-- Tool Access Configs — admin-controlled access levels per calculator tool.
-- Supports free/pro/campaign gating with time-limited campaign overrides.
-- Empty table = legacy PRO_TOOLS_IDS behaviour is preserved on the client.

CREATE TABLE IF NOT EXISTS public.tool_access_configs (
    tool_id                  text PRIMARY KEY,
    -- Basic access: 'free' | 'pro' | 'campaign'
    access_level             text NOT NULL DEFAULT 'free',
    -- If access_level = 'campaign', tool is free until this timestamp
    campaign_until           timestamptz,
    -- Advanced-mode access: 'free' | 'pro' | 'campaign' | 'inherit'
    -- 'inherit' means advanced follows access_level
    advanced_access_level    text NOT NULL DEFAULT 'inherit',
    advanced_campaign_until  timestamptz,
    note                     text,
    updated_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT tool_access_configs_access_level_check
        CHECK (access_level IN ('free', 'pro', 'campaign')),
    CONSTRAINT tool_access_configs_advanced_access_level_check
        CHECK (advanced_access_level IN ('free', 'pro', 'campaign', 'inherit')),
    -- campaign_until must be in the future when access_level = 'campaign'
    -- (enforced at application layer; DB stores it as-is for history)
    CONSTRAINT tool_access_configs_campaign_requires_date
        CHECK (access_level <> 'campaign' OR campaign_until IS NOT NULL),
    CONSTRAINT tool_access_configs_advanced_campaign_requires_date
        CHECK (advanced_access_level <> 'campaign' OR advanced_campaign_until IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tool_access_configs_access_level
    ON public.tool_access_configs(access_level);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors ai_provider_configs: admin read/write only.
-- API server uses service role (bypasses RLS) for all runtime reads.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tool_access_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tool_access_configs_admin_all" ON public.tool_access_configs
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-update updated_at (reuses public.set_updated_at() from
-- 20260606000000_admin_company_role.sql)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tool_access_configs_set_updated_at ON public.tool_access_configs;
CREATE TRIGGER tool_access_configs_set_updated_at
    BEFORE UPDATE ON public.tool_access_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
