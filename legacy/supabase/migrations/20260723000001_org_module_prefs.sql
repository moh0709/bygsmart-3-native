-- ============================================================
-- MIGRATION: org_module_prefs — owner-level module deactivation
-- (PRESENTATION LAYER ONLY, independent of billing / entitlements).
--
-- An org owner can "turn off" a module from the /moduler marketplace.
-- A deactivated module behaves exactly as if it were never installed:
-- its nav entry, routes, project tabs and widgets disappear — because
-- the client subtracts these ids from EntitlementsProvider's
-- `enabledModules` gating set. Nothing about billing changes.
--
-- This is deliberately SEPARATE from org_module_entitlements:
--   * org_module_entitlements carries billing/purchase truth (Stripe
--     subscription item ids, grandfather resolution) and is written
--     ONLY by the service role. A presentation preference must never
--     clobber it.
--   * org_module_prefs is a thin owner preference. Deleting a row (or
--     never applying this migration at all) restores the module
--     instantly, with zero billing side effects — the subscription
--     keeps running until the owner cancels it on the module's own
--     detail page.
--
-- A row present with hidden = true ⇒ the module is deactivated for the
-- org. Reactivation deletes the row.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_module_prefs (
    org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    module_id  text NOT NULL,
    hidden     boolean NOT NULL DEFAULT true,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (org_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_omp_org ON public.org_module_prefs (org_id);

ALTER TABLE public.org_module_prefs ENABLE ROW LEVEL SECURITY;

-- Every org member READS the org's prefs (so all seats see the same
-- deactivated set and receive realtime flips); only the org OWNER
-- writes — mirrors the owner-only write posture of org_teams
-- (20260716000005) using the get_org_role() helper from
-- 20260713000002.
DROP POLICY IF EXISTS "omp_select_member" ON public.org_module_prefs;
CREATE POLICY "omp_select_member" ON public.org_module_prefs
    FOR SELECT TO authenticated
    USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "omp_insert_owner" ON public.org_module_prefs;
CREATE POLICY "omp_insert_owner" ON public.org_module_prefs
    FOR INSERT TO authenticated
    WITH CHECK (public.get_org_role(org_id) = 'owner');

DROP POLICY IF EXISTS "omp_update_owner" ON public.org_module_prefs;
CREATE POLICY "omp_update_owner" ON public.org_module_prefs
    FOR UPDATE TO authenticated
    USING (public.get_org_role(org_id) = 'owner')
    WITH CHECK (public.get_org_role(org_id) = 'owner');

DROP POLICY IF EXISTS "omp_delete_owner" ON public.org_module_prefs;
CREATE POLICY "omp_delete_owner" ON public.org_module_prefs
    FOR DELETE TO authenticated
    USING (public.get_org_role(org_id) = 'owner');

-- Keep updated_at fresh on upsert (shared house set_updated_at trigger).
DROP TRIGGER IF EXISTS org_module_prefs_set_updated_at ON public.org_module_prefs;
CREATE TRIGGER org_module_prefs_set_updated_at
    BEFORE UPDATE ON public.org_module_prefs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime: the client subscribes to its active org's prefs and hides /
-- reveals modules live, mirroring org_module_entitlements (20260714000001).
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_module_prefs;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
