-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 10: Sync infrastructure (the offline-native spine)
-- ============================================================================
-- Unifies the THREE competing updated_at mechanisms of 2.1
-- (handle_updated_at / set_updated_at / inline NEW.updated_at) into ONE
-- canonical BEFORE-UPDATE trigger function, and adds the pieces the offline
-- sync engine needs but 2.1 has zero of:
--   * soft-delete + emitted tombstone (retention >= the 14-day offline grace)
--   * a server-side idempotency store for the mutation endpoint
--   * the ONE first-class "cascade-from-a-dead-parent vs ad-hoc mutation" rule
--
-- Store-agnostic on purpose (D-11 sync engine choice is still open): the server
-- owns updated_at / deleted_at / tombstones; the client-only _local_id / _dirty
-- / _conflict columns from AUDIT §7.3 live on the device, never here.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.1  UNIFIED updated_at  — replaces handle_updated_at() + set_updated_at() +
--       the time_registrations inline assignment. Every syncable table gets a
--       BEFORE UPDATE trigger bound to this ONE function, plus an (updated_at,id)
--       index (the sync cursor is always the pair, never timestamp-alone).
--
--       task_check_ins is the canonical 2.1 bug: it mutates on check-out /
--       auto-close but had no updated_at, so the cursor silently missed those
--       updates. Here it is trigger-maintained like every other syncable table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'The ONE canonical updated_at maintainer for every syncable table. Unifies '
  '2.1''s handle_updated_at / set_updated_at / inline mechanisms.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.2  TOMBSTONES  — the delete feed the pull cursor serves.
--
--   Canonical delete == SOFT delete: the sync mutation layer NEVER issues a raw
--   DELETE on a syncable table; it sets deleted_at = now(). The row stays
--   RLS-scoped and is served (with deleted_at set) by the pull cursor until the
--   retention purge removes it, by which time every device <= 14 days old has
--   already seen the delete.
--
--   sync_tombstones additionally records EVERY disappearance (soft delete,
--   physical purge, GDPR erasure, and access-revocation cascades) so the pull
--   RPC can still emit a delete event to a user who lost access — the case
--   AUDIT §7.4 flagged where a hard cascade otherwise "persists on devices
--   forever". Append-only; scope columns let the pull RPC filter by what the
--   caller may see.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_tombstones (
  entity_table  text        NOT NULL,
  entity_id     uuid        NOT NULL,
  project_id    uuid,                    -- scope hint (nullable; quick-task rows have none)
  org_id        uuid,                    -- scope hint
  owner_user_id uuid,                    -- scope hint (row's user_id/owner_id when present)
  op            public.sync_op NOT NULL DEFAULT 'delete',
  deleted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_table, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_tombstones_cursor
  ON public.sync_tombstones (deleted_at, entity_table);
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_project ON public.sync_tombstones (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_org     ON public.sync_tombstones (org_id)     WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_owner   ON public.sync_tombstones (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Generic tombstone emitter. Bound (AFTER UPDATE OR DELETE) to every id-PK
-- syncable table. Reads scope keys generically via to_jsonb(row) so ONE
-- function serves all tables. Composite-PK link tables (document_visibility,
-- task_chat_reads, org_time_responsibles, org_module_entitlements) are NOT
-- tombstoned directly — their deletion is derived from their parent's tombstone
-- (see README §"Judgement calls").
CREATE OR REPLACE FUNCTION public.emit_tombstone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     jsonb;
  v_id      uuid;
  v_emit    boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row  := to_jsonb(OLD);
    v_emit := true;                                   -- physical purge / GDPR / cascade
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD)->>'deleted_at') IS NULL
       AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL THEN
      v_row  := to_jsonb(NEW);                        -- soft delete transition
      v_emit := true;
    END IF;
  END IF;

  IF v_emit THEN
    v_id := NULLIF(v_row->>'id', '')::uuid;
    IF v_id IS NOT NULL THEN
      INSERT INTO public.sync_tombstones
        (entity_table, entity_id, project_id, org_id, owner_user_id, op, deleted_at)
      VALUES (
        TG_TABLE_NAME,
        v_id,
        NULLIF(v_row->>'project_id', '')::uuid,
        NULLIF(v_row->>'org_id', '')::uuid,
        COALESCE(NULLIF(v_row->>'user_id', '')::uuid, NULLIF(v_row->>'owner_id', '')::uuid),
        'delete',
        now()
      )
      ON CONFLICT (entity_table, entity_id)
        DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.emit_tombstone() IS
  'Records every disappearance of an id-PK syncable row (soft delete transition, '
  'physical delete, cascade) into sync_tombstones so the pull cursor can emit a '
  'delete event even after the row is purged or access is revoked.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.3  SOFT-DELETE CASCADE  — replaces the syncable hard ON DELETE CASCADE
--       fan-out. When a parent is soft-deleted, its syncable children are
--       soft-deleted too (which fires their own set_updated_at + emit_tombstone),
--       so an offline device learns about the whole subtree.
--
--       Physical ON DELETE CASCADE is retained on syncable child FKs ONLY as the
--       purge/GDPR cleanup safety-net (documented per-FK). The authoritative,
--       device-visible delete path is this soft cascade.
--
--       cascade_soft_delete(child_table, fk_column) is parameterised via trigger
--       arguments so ONE function drives every root→child edge.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cascade_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_table text := TG_ARGV[0];
  v_fk_column   text := TG_ARGV[1];
BEGIN
  -- Only act on the NULL -> NOT NULL soft-delete transition.
  IF (to_jsonb(OLD)->>'deleted_at') IS NULL
     AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.%I SET deleted_at = now() WHERE %I = $1 AND deleted_at IS NULL',
      v_child_table, v_fk_column
    ) USING NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cascade_soft_delete() IS
  'Propagates a soft delete from a parent to a syncable child table. Bound once '
  'per root->child edge via CREATE TRIGGER ... EXECUTE FUNCTION '
  'cascade_soft_delete(''child_table'', ''fk_column''). Child triggers then emit '
  'their own tombstones.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.4  THE UNIFIED CASCADE-VS-GUARD RULE  (Req 4 — first-class, not two patches)
--
--   2.1 patched two deadlocks reactively:
--     * reject_ledger_mutation()   — append-only budget ledger blocked project
--       (and therefore owner) deletion.
--     * protect_last_org_owner()   — last-owner guard blocked account/GDPR
--       deletion (every user is sole owner of a personal org).
--
--   Both share ONE rule: an integrity guard must reject an *ad-hoc* mutation but
--   ALLOW a row to disappear when it is only disappearing because its parent is
--   already gone (a cascade). parent_is_gone() is that single, DEFINER-rights
--   decision — DEFINER so the parent lookup is not blinded by the caller's RLS
--   (a caller who merely cannot SEE the parent must NOT look like a cascade).
--
--   In the offline-native world "gone" means EITHER physically absent OR
--   soft-deleted (deleted_at IS NOT NULL) — a soft-deleted parent is logically
--   dead, so its history/children may be released.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parent_is_gone(p_table regclass, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_has_deleted_at boolean;
  v_live boolean;
BEGIN
  IF p_id IS NULL THEN
    RETURN true;   -- no parent reference at all == nothing to protect
  END IF;

  -- Does the target table carry a deleted_at column?
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = p_table AND attname = 'deleted_at' AND NOT attisdropped
  ) INTO v_has_deleted_at;

  IF v_has_deleted_at THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE id = $1 AND deleted_at IS NULL)', p_table)
      INTO v_live USING p_id;
    RETURN NOT v_live;                 -- gone == not (present and live)
  ELSE
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE id = $1)', p_table)
      INTO v_exists USING p_id;
    RETURN NOT v_exists;               -- gone == physically absent
  END IF;
END;
$$;

COMMENT ON FUNCTION public.parent_is_gone(regclass, uuid) IS
  'The ONE cascade-vs-guard primitive. Returns TRUE when a parent row is '
  'logically dead (soft-deleted) or physically absent, so an integrity guard '
  'can allow the child/history row to be released. SECURITY DEFINER so RLS '
  'cannot make a merely-invisible parent masquerade as a deleted one.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.5  IDEMPOTENCY STORE  (Req 3) — POST /api/sync/mutations dedupe.
--       Client-generated UUID key per mutation; server persists the result and
--       replays it on retry. TTL >= the 14-day offline grace so a mutation
--       queued offline for up to two weeks still dedupes on delivery.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_idempotency_keys (
  idempotency_key uuid        NOT NULL,          -- client-generated per mutation
  -- FK to profiles(id) is a forward reference (profiles is created in 20_identity.sql);
  -- added deferred there, matching the profiles_active_org_fkey pattern.
  user_id         uuid        NOT NULL,
  request_hash    text,                          -- guards key-reuse with a different body
  response        jsonb,                          -- persisted result to replay
  status          text        NOT NULL DEFAULT 'completed'
                              CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  PRIMARY KEY (idempotency_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_idempotency_expires
  ON public.sync_idempotency_keys (expires_at);

-- RLS: idempotency rows are server-mediated (the mutation endpoint uses the
-- service role). A client may read its own keys for diagnostics only.
ALTER TABLE public.sync_idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_idem_select_own" ON public.sync_idempotency_keys;
CREATE POLICY "sync_idem_select_own" ON public.sync_idempotency_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- sync_tombstones RLS: the pull RPC runs SECURITY DEFINER and scopes rows to the
-- caller; a direct client SELECT is denied (no positive policy) — deletes reach
-- the client only through the adjudicated pull endpoint (AUDIT §7.5: the client
-- never adjudicates access).
ALTER TABLE public.sync_tombstones ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10.6  RETENTION PURGE  — physically removes soft-deleted rows and stale
--       tombstones AFTER the grace window. Retention MUST be >= 14 days.
--       Intended to run daily (pg_cron / external scheduler — see README, flagged
--       for human sign-off on cadence + window length).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_sync_state(p_retention interval DEFAULT interval '14 days')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tbl text;
  -- Every id-PK syncable table (composite-PK link tables purge via their parent).
  v_syncable text[] := ARRAY[
    'projects','tasks','project_resources','resource_task_access','quick_task_access',
    'task_check_ins','task_documentation','task_handovers','task_quality_controls',
    'task_chat_messages','punch_list_layouts','punch_list_items','documents',
    'time_entries','time_registrations','purchases','reminders','activity_log',
    'quotations','quotation_line_items','task_budget_rates'
  ];
BEGIN
  IF p_retention < interval '14 days' THEN
    RAISE EXCEPTION 'Retention window must be >= 14 days (offline grace).';
  END IF;

  FOREACH v_tbl IN ARRAY v_syncable LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE deleted_at IS NOT NULL AND deleted_at < now() - $1',
      v_tbl
    ) USING p_retention;
  END LOOP;

  -- Keep tombstones a little longer than row retention so a device that has been
  -- offline for the full grace still receives the delete before the tombstone goes.
  DELETE FROM public.sync_tombstones WHERE deleted_at < now() - (p_retention + interval '7 days');

  -- Idempotency TTL sweep.
  DELETE FROM public.sync_idempotency_keys WHERE expires_at < now();
END;
$$;

COMMENT ON FUNCTION public.purge_expired_sync_state(interval) IS
  'Daily retention purge. Hard-deletes soft-deleted syncable rows older than the '
  'retention window (>= 14-day offline grace) and sweeps stale tombstones + '
  'expired idempotency keys.';

REVOKE ALL ON FUNCTION public.purge_expired_sync_state(interval) FROM PUBLIC, anon, authenticated;
-- Executed by the scheduler under the service role only.
