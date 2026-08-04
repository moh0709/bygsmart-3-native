-- ============================================================
-- MIGRATION: Drop legacy tasks.offers column
--
-- The offers JSONB column stored the old TaskOffer negotiation
-- log inline on each task row. This path has been superseded by
-- the canonical project_partners + partner_negotiation_messages
-- tables (see 20260610000001_partner_collaboration.sql).
--
-- Safe-migration protocol:
--   1. If the column does not exist the migration is a no-op.
--   2. If the column exists but all offers values are NULL it is
--      dropped immediately — nothing to preserve.
--   3. If non-null legacy payload rows are found they are copied
--      verbatim into _legacy_task_offers_backup BEFORE the column
--      is dropped, so data is recoverable even when a full
--      automatic mapping to the canonical partner tables is not
--      feasible at migration time.
--
-- Non-destructive guard: IF EXISTS makes the final DROP idempotent
-- and safe to re-run on databases that had the column removed
-- manually after a backup was already taken.
-- ============================================================

DO $$
DECLARE
    v_col_exists BOOLEAN;
    v_row_count  BIGINT;
    v_backed_up  BIGINT;
BEGIN
    -- 1. Guard: column may already have been dropped.
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'tasks'
          AND column_name  = 'offers'
    ) INTO v_col_exists;

    IF NOT v_col_exists THEN
        RAISE NOTICE 'tasks.offers does not exist — migration is a no-op.';
        RETURN;
    END IF;

    -- 2. Count non-null legacy rows.
    EXECUTE 'SELECT COUNT(*) FROM public.tasks WHERE offers IS NOT NULL'
        INTO v_row_count;

    IF v_row_count = 0 THEN
        RAISE NOTICE 'tasks.offers has no non-null rows — dropping column directly.';
    ELSE
        RAISE NOTICE 'Found % non-null offers row(s). Preserving to backup table before drop.', v_row_count;

        -- 3. Create backup table and copy legacy payloads verbatim.
        --    The table is intentionally left in place after the migration
        --    so that a manual backfill into project_partners /
        --    partner_task_access / partner_negotiation_messages can be
        --    performed at any time without re-running this migration.
        CREATE TABLE IF NOT EXISTS public._legacy_task_offers_backup (
            task_id      UUID        NOT NULL,
            offers       JSONB       NOT NULL,
            backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        EXECUTE '
            INSERT INTO public._legacy_task_offers_backup (task_id, offers)
            SELECT id, offers
            FROM public.tasks
            WHERE offers IS NOT NULL
        ';
        GET DIAGNOSTICS v_backed_up = ROW_COUNT;
        RAISE NOTICE 'Backed up % row(s) to _legacy_task_offers_backup.', v_backed_up;
    END IF;

    -- 4. Drop the column now that legacy data is preserved.
    ALTER TABLE public.tasks DROP COLUMN IF EXISTS offers;
    RAISE NOTICE 'tasks.offers column dropped successfully.';
END;
$$;
