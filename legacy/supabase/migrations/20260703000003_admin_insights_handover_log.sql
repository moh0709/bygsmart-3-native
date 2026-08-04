-- Admin insights, Phase 4: make the on-demand AI project handover report
-- ("Overdragelsesrapport") countable. Additive migration — one new small
-- table, one new view, no changes to existing tables.
--
-- Today this report (services/gemini.ts generateHandoverReport, triggered from
-- ProjectDetailPage.tsx) is generated and saved entirely client-side — it never
-- touches the backend, so there was no way to count how many were generated.
-- One row is written here (via POST /api/reports/ai-handover, service role)
-- right after the PDF download succeeds. Best-effort: a failed insert never
-- blocks the user's download.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ai_handover_reports_log — one row per generated on-demand report
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_handover_reports_log (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_handover_reports_log_project_created
    ON public.ai_handover_reports_log(project_id, generated_at DESC);

-- RLS — service-role-only writes (mirrors member_terminations); the project
-- owner and admins may read. No INSERT/UPDATE/DELETE policies are created, so
-- writes are only possible via the service role (the API server).
ALTER TABLE public.ai_handover_reports_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_handover_reports_log_owner_select" ON public.ai_handover_reports_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects pr
            WHERE pr.id = ai_handover_reports_log.project_id
              AND pr.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.app_role = 'admin'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_handover_reports_v — unifies all three "Overdragelsesrapport"
--    sources into one shape for future drill-down/listing views. Row-level
--    security on the underlying tables still applies when this view is queried.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_handover_reports_v AS
SELECT
    id,
    project_id,
    'task_handover'::text AS source,
    status,
    submitted_by AS actor_id,
    created_at
FROM public.task_handovers
UNION ALL
SELECT
    id,
    project_id,
    'member_termination'::text AS source,
    NULL::text AS status,
    removed_by AS actor_id,
    created_at
FROM public.member_terminations
UNION ALL
SELECT
    id,
    project_id,
    'ai_handover'::text AS source,
    NULL::text AS status,
    generated_by AS actor_id,
    generated_at AS created_at
FROM public.ai_handover_reports_log;
