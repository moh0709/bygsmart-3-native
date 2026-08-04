-- Phase 3: Admin Dashboard, Company/Role Multi-Tenancy & Analytics
-- Additive migration — does not alter existing columns, only adds new ones.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Companies table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    cvr         text,
    address     text,
    logo_url    text,
    owner_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add app_role to profiles (account-level; distinct from project-scoped role)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS app_role text NOT NULL DEFAULT 'user';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add company_id FK to profiles and projects (nullable for backward compat)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_app_role    ON public.profiles(app_role);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id  ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id  ON public.projects(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS for companies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Members of a company can read their own company row.
CREATE POLICY "company_members_read" ON public.companies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.company_id = companies.id
        )
        OR owner_id = auth.uid()
    );

-- Company owner can update their company row.
CREATE POLICY "company_owner_update" ON public.companies
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Company owner can insert (create) their company.
CREATE POLICY "company_owner_insert" ON public.companies
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Auto-update updated_at on companies
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
