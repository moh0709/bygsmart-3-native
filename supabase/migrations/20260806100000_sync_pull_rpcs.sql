-- ============================================================================
-- BygSmart 3.0 Native — Sync pull RPCs (P2 2.2)
-- ============================================================================
-- The pull endpoint serves visible rows via RLS directly, but deletes need the
-- sync_tombstones feed — and that table has RLS ENABLED WITH NO POSITIVE POLICY
-- (10_sync_infrastructure.sql), so a client can never read it directly. This
-- SECURITY DEFINER RPC is the adjudicated door: it returns tombstones for an
-- entity that the CALLER could have seen, reusing the canonical RLS membership
-- helpers — so a device learns about deletes of rows it once had access to
-- (AUDIT §7.4/§7.5) without leaking the existence of rows it never could.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_pull_tombstones(p_entity text, p_since timestamptz)
RETURNS TABLE (entity_id uuid, deleted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.entity_id, t.deleted_at
  FROM public.sync_tombstones t
  WHERE t.entity_table = p_entity
    AND t.deleted_at > p_since
    AND (
      -- the caller owned the row …
      t.owner_user_id = auth.uid()
      -- … or is a member of its project …
      OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
      -- … or a member of its org.
      OR (t.org_id IS NOT NULL AND public.is_org_member(t.org_id))
    )
  ORDER BY t.deleted_at, t.entity_id;
$$;

COMMENT ON FUNCTION public.sync_pull_tombstones(text, timestamptz) IS
  'Adjudicated delete feed for GET /api/sync/:entity. Returns tombstones the '
  'caller could have seen (owner / project member / org member), reusing the RLS '
  'helpers. sync_tombstones is otherwise unreadable by clients (RLS, no policy).';

REVOKE ALL ON FUNCTION public.sync_pull_tombstones(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_pull_tombstones(text, timestamptz) TO authenticated;
