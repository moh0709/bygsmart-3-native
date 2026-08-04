-- ============================================================
-- MIGRATION: organization backfill (Phase 2 of the BYG 3.0
-- modular monolith).
--
-- Converts the three legacy group concepts into organizations:
--   1. every team            → an org (leader = owner, seats = members)
--   2. every claimed company → absorbed into its team-org, or its own org
--   3. every remaining user  → a personal org
-- Then points profiles.active_org_id and projects.org_id.
--
-- IDEMPOTENT: source_team_id / source_company_id unique keys +
-- NOT EXISTS guards let this re-run safely. ALL BACKFILLED ORGS ARE
-- GRANDFATHERED (they keep every module forever — plan decision D5).
--
-- The final DO block asserts every profile ended up with an active
-- membership — on failure the whole migration rolls back.
-- ============================================================

-- ── 1. Teams → organizations (leader's company provides the display data) ──
INSERT INTO public.organizations
    (name, cvr, address, logo_url, created_by, grandfathered, source_team_id)
SELECT
    COALESCE(
        NULLIF(TRIM(c.name), ''),
        NULLIF(TRIM(p.company_name), ''),
        NULLIF(TRIM(t.name), ''),
        p.name || 's organisation'
    ),
    c.cvr, c.address, c.logo_url,
    t.leader_id, TRUE, t.id
FROM public.teams t
JOIN public.profiles p ON p.id = t.leader_id
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE t.leader_id IS NOT NULL
ON CONFLICT (source_team_id) DO NOTHING;

-- ── 1b. Team-orgs claim their leader's company (one org per company) ──
WITH claim AS (
    SELECT DISTINCT ON (c.id) o.id AS org_id, c.id AS company_id
    FROM public.organizations o
    JOIN public.teams t ON t.id = o.source_team_id
    JOIN public.profiles p ON p.id = t.leader_id
    JOIN public.companies c ON c.id = p.company_id
    WHERE NOT EXISTS (SELECT 1 FROM public.organizations o2 WHERE o2.source_company_id = c.id)
    ORDER BY c.id, o.created_at
)
UPDATE public.organizations o
SET source_company_id = claim.company_id
FROM claim
WHERE o.id = claim.org_id
  AND o.source_company_id IS NULL;

-- ── 2. Unclaimed companies with an owner → their own org ──
INSERT INTO public.organizations
    (name, cvr, address, logo_url, created_by, grandfathered, source_company_id)
SELECT
    COALESCE(NULLIF(TRIM(c.name), ''), 'Organisation'),
    c.cvr, c.address, c.logo_url,
    c.owner_id, TRUE, c.id
FROM public.companies c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.source_company_id = c.id)
ON CONFLICT (source_company_id) DO NOTHING;

-- ── 3a. Team leaders → owner memberships ──
INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
SELECT o.id, t.leader_id, 'owner', 'active', now()
FROM public.organizations o
JOIN public.teams t ON t.id = o.source_team_id
WHERE t.leader_id IS NOT NULL
ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- ── 3b. Company owners → owner memberships (covers absorbed companies too) ──
INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
SELECT o.id, c.owner_id, 'owner', 'active', now()
FROM public.organizations o
JOIN public.companies c ON c.id = o.source_company_id
WHERE c.owner_id IS NOT NULL
ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- ── 3c. Team seats → memberships (active seats active, pending pending) ──
INSERT INTO public.organization_members (org_id, user_id, role, status, invited_by, accepted_at)
SELECT o.id, ts.profile_id, 'member',
       CASE WHEN ts.status = 'active' THEN 'active' ELSE 'pending' END,
       t.leader_id,
       CASE WHEN ts.status = 'active' THEN now() ELSE NULL END
FROM public.organizations o
JOIN public.teams t ON t.id = o.source_team_id
JOIN public.team_seats ts ON ts.team_id = t.id
WHERE ts.profile_id IS NOT NULL
  AND ts.status IN ('active', 'pending')
ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- Pending e-mail-only seats → pending org email invites.
INSERT INTO public.organization_members (org_id, invite_email, role, status, invited_by)
SELECT o.id, LOWER(ts.email), 'member', 'pending', t.leader_id
FROM public.organizations o
JOIN public.teams t ON t.id = o.source_team_id
JOIN public.team_seats ts ON ts.team_id = t.id
WHERE ts.profile_id IS NULL
  AND ts.email IS NOT NULL
  AND ts.status = 'pending'
ON CONFLICT (org_id, invite_email) WHERE invite_email IS NOT NULL AND user_id IS NULL DO NOTHING;

-- ── 3d. Profiles sharing a claimed company (CVR auto-link) → members ──
INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
SELECT o.id, p.id, 'member', 'active', now()
FROM public.organizations o
JOIN public.companies c ON c.id = o.source_company_id
JOIN public.profiles p ON p.company_id = c.id
WHERE p.id IS DISTINCT FROM c.owner_id
ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- ── 3e. Personal orgs for everyone still without a membership ──
INSERT INTO public.organizations (name, created_by, grandfathered)
SELECT
    COALESCE(NULLIF(TRIM(p.company_name), ''), p.name || 's organisation'),
    p.id, TRUE
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = p.id)
  AND NOT EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.created_by = p.id AND o.source_team_id IS NULL AND o.source_company_id IS NULL
  );

INSERT INTO public.organization_members (org_id, user_id, role, status, accepted_at)
SELECT o.id, o.created_by, 'owner', 'active', now()
FROM public.organizations o
WHERE o.source_team_id IS NULL
  AND o.source_company_id IS NULL
ON CONFLICT (org_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- ── 4. active_org_id — best org first (team-backed > company > personal) ──
UPDATE public.profiles p
SET active_org_id = pick.org_id
FROM (
    SELECT DISTINCT ON (m.user_id) m.user_id, m.org_id
    FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.status = 'active'
    ORDER BY m.user_id,
             (o.source_team_id IS NOT NULL) DESC,
             (o.source_company_id IS NOT NULL) DESC,
             m.created_at
) pick
WHERE p.id = pick.user_id
  AND p.active_org_id IS NULL;

-- ── 5. projects.org_id ──
-- Via the project's own company link first…
UPDATE public.projects pr
SET org_id = o.id
FROM public.organizations o
WHERE pr.org_id IS NULL
  AND pr.company_id IS NOT NULL
  AND o.source_company_id = pr.company_id;

-- …then via the owner's active org.
UPDATE public.projects pr
SET org_id = p.active_org_id
FROM public.profiles p
WHERE pr.org_id IS NULL
  AND pr.owner_id = p.id
  AND p.active_org_id IS NOT NULL;

-- ── 6. Assertions — roll the whole migration back if incomplete ──
DO $$
DECLARE
    v_profiles_total     integer;
    v_profiles_no_member integer;
    v_profiles_no_active integer;
    v_projects_no_org    integer;
    v_orgs               integer;
BEGIN
    SELECT COUNT(*) INTO v_profiles_total FROM public.profiles;
    SELECT COUNT(*) INTO v_profiles_no_member
    FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.user_id = p.id AND m.status = 'active'
    );
    SELECT COUNT(*) INTO v_profiles_no_active
    FROM public.profiles WHERE active_org_id IS NULL;
    SELECT COUNT(*) INTO v_projects_no_org
    FROM public.projects WHERE org_id IS NULL;
    SELECT COUNT(*) INTO v_orgs FROM public.organizations;

    RAISE NOTICE 'org backfill: % orgs · %/% profiles with active membership · % profiles without active_org_id · % projects without org_id',
        v_orgs, v_profiles_total - v_profiles_no_member, v_profiles_total,
        v_profiles_no_active, v_projects_no_org;

    IF v_profiles_no_member > 0 THEN
        RAISE EXCEPTION 'org backfill incomplete: % profiles have no active membership', v_profiles_no_member;
    END IF;
    IF v_profiles_no_active > 0 THEN
        RAISE EXCEPTION 'org backfill incomplete: % profiles have no active_org_id', v_profiles_no_active;
    END IF;
    -- projects may legitimately lack an org (orphaned owner) — report only.
END $$;
