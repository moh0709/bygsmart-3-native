-- Migration: CVR → company auto-provisioning
-- Adds company_name to profiles, normalises CVR values, and wires a trigger
-- that upserts a company row and back-links profiles.company_id on save.

-- ────────────────────────────────────────────────────────────────
-- 1. Add company_name to profiles (denormalised input field)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

-- ────────────────────────────────────────────────────────────────
-- 2. CVR normaliser helper
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_cvr(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
    SELECT CASE
        WHEN length(regexp_replace(raw, '[^0-9]', '', 'g')) = 8
        THEN regexp_replace(raw, '[^0-9]', '', 'g')
        ELSE NULL
    END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. Normalise existing companies.cvr values and remove duplicates
-- ────────────────────────────────────────────────────────────────
UPDATE public.companies
SET cvr = public.normalize_cvr(cvr)
WHERE cvr IS NOT NULL;

-- Keep only the oldest row per CVR
DELETE FROM public.companies
WHERE cvr IS NOT NULL
  AND id NOT IN (
      SELECT MIN(id)
      FROM public.companies
      WHERE cvr IS NOT NULL
      GROUP BY cvr
  );

-- ────────────────────────────────────────────────────────────────
-- 4. Unique index on companies(cvr) — partial (only where non-NULL)
-- ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS companies_cvr_unique
    ON public.companies (cvr)
    WHERE cvr IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 5. Trigger function: link profile → company via CVR
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_profile_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_cvr text;
    resolved_company_id uuid;
BEGIN
    normalized_cvr := public.normalize_cvr(NEW.cvr);

    -- CVR cleared or invalid → unlink
    IF normalized_cvr IS NULL THEN
        NEW.company_id := NULL;
        RETURN NEW;
    END IF;

    -- Attempt to create the company (no-op on conflict)
    INSERT INTO public.companies (name, cvr, address, owner_id)
    VALUES (
        COALESCE(NULLIF(NEW.company_name, ''), 'CVR ' || normalized_cvr),
        normalized_cvr,
        NEW.address,
        NEW.id
    )
    ON CONFLICT (cvr) WHERE cvr IS NOT NULL DO NOTHING
    RETURNING id INTO resolved_company_id;

    -- If row already existed, look it up
    IF resolved_company_id IS NULL THEN
        SELECT id INTO resolved_company_id
        FROM public.companies
        WHERE cvr = normalized_cvr;
    END IF;

    NEW.company_id := resolved_company_id;
    RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 6. Attach trigger to profiles
-- ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS profiles_link_company ON public.profiles;
CREATE TRIGGER profiles_link_company
    BEFORE INSERT OR UPDATE OF cvr, company_name ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.link_profile_company();

-- ────────────────────────────────────────────────────────────────
-- 7. Backfill existing profiles that already have a CVR
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    normalized_cvr text;
    resolved_company_id uuid;
BEGIN
    FOR rec IN
        SELECT id, cvr, company_name, address
        FROM public.profiles
        WHERE cvr IS NOT NULL AND cvr <> ''
    LOOP
        normalized_cvr := public.normalize_cvr(rec.cvr);
        CONTINUE WHEN normalized_cvr IS NULL;

        INSERT INTO public.companies (name, cvr, address, owner_id)
        VALUES (
            COALESCE(NULLIF(rec.company_name, ''), 'CVR ' || normalized_cvr),
            normalized_cvr,
            rec.address,
            rec.id
        )
        ON CONFLICT (cvr) WHERE cvr IS NOT NULL DO NOTHING
        RETURNING id INTO resolved_company_id;

        IF resolved_company_id IS NULL THEN
            SELECT id INTO resolved_company_id
            FROM public.companies
            WHERE cvr = normalized_cvr;
        END IF;

        UPDATE public.profiles
        SET company_id = resolved_company_id
        WHERE id = rec.id;
    END LOOP;
END;
$$;
