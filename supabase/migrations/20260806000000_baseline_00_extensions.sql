-- ============================================================================
-- BygSmart 3.0 Native — Consolidated Offline-Native Baseline
-- SECTION 00: Extensions + Enums
-- ============================================================================
-- P0.3 deliverable — DRAFT for human review. Nothing here has been provisioned
-- or run against a database. This file is the net effect of replaying the 85
-- BygSmart 2.1 migrations, re-derived for the offline-native access model.
--
-- Guardrail: NO legacy/retired tables are reborn. Explicitly EXCLUDED from this
-- baseline (present in the old project, deliberately NOT ported):
--   companies, company_id columns, project_partners, partner_task_access,
--   teams, team_seats, _legacy_task_offers_backup, profiles.team_id/team_role,
--   the legacy partner_negotiation_messages.partner_invite_id path.
--
-- Cross-cutting invariants baked in from line one (from the 18 fix-of-fix
-- migrations — see README §"Born-correct invariants"):
--   1. Every SECURITY DEFINER function pins  SET search_path = public.
--   2. No RLS policy reads the table it protects — always via a DEFINER helper.
--   3. Views over RLS-protected tables are  security_invoker = true.
--   4. RPC / helper GRANT EXECUTE ... TO authenticated only, never anon/public.
--   5. Append-only / integrity guards distinguish an ad-hoc mutation (reject)
--      from a cascade out of an already-dead parent (allow) — ONE shared rule.
-- ============================================================================

-- ── Section 1: Extensions ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() (also core in PG13+)

-- ── Section 2: Enums ─────────────────────────────────────────────────────────
-- Net enums from the 2.1 schema. New offline-native enum: sync_op (tombstone
-- feed operation classifier). resource_kind/resource_status are modelled as
-- CHECK constraints on project_resources (matching 2.1) rather than enums, to
-- keep the column set store-agnostic; see 30_projects_tasks.sql.

DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('FREE', 'PRO', 'PREMIUM', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role_type AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_status_type AS ENUM ('ACTIVE', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.log_level_type AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Offline-native additions.
DO $$ BEGIN
  CREATE TYPE public.sync_op AS ENUM ('upsert', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
