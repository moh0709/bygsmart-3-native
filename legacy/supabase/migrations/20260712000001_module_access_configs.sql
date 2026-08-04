-- Module Access Configs — global per-module defaults for the BYG 3.0 module
-- entitlement engine (Kernel, Phase 1).
--
-- One row per module id (19 canonical ids, see server/moduleCatalog.js).
--   enabled  = FALSE is the platform-wide kill-switch for a module.
--   min_tier = lowest subscription tier that includes the module for orgs
--              created after marketplace launch (NULL = included for everyone).
-- Empty table = fail-open: every module resolves to enabled (the same
-- contract as tool_access_configs — legacy behaviour is preserved until an
-- admin writes a row). Per-org overrides land in org_module_entitlements
-- (Phase 3); this table only holds the global defaults.

CREATE TABLE IF NOT EXISTS public.module_access_configs (
    module_id   text PRIMARY KEY,
    enabled     boolean NOT NULL DEFAULT TRUE,
    min_tier    public.subscription_tier,
    note        text,
    updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — mirrors tool_access_configs: admin read/write only.
-- The API server uses the service role (bypasses RLS) for all runtime reads.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.module_access_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_access_configs_admin_all" ON public.module_access_configs
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
DROP TRIGGER IF EXISTS module_access_configs_set_updated_at ON public.module_access_configs;
CREATE TRIGGER module_access_configs_set_updated_at
    BEFORE UPDATE ON public.module_access_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
