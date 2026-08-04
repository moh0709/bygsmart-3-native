-- ============================================================
-- MIGRATION: per-task tab visibility ("Faner" settings panel).
--
-- disabled_tabs stores which tab-registry ids are hidden for
-- THIS task instance (owner/responsible-configurable). Written
-- only through set_task_disabled_tabs(), never a raw client
-- .update(), so a tampered client can't hide the always-on
-- safety-critical tabs (overblik/tid/chat) — enforced here
-- server-side, mirrored client-side in the tab registry.
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS disabled_tabs TEXT[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.set_task_disabled_tabs(p_task_id UUID, p_disabled_tabs TEXT[])
RETURNS VOID AS $$
DECLARE
    v_allowed TEXT[];
BEGIN
    IF public.get_effective_task_role(p_task_id) NOT IN ('owner', 'responsible') THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    -- Strip the always-on allowlist even if the client tried to include it.
    SELECT COALESCE(ARRAY(
        SELECT unnest(p_disabled_tabs)
        EXCEPT
        SELECT unnest(ARRAY['overblik', 'tid', 'chat'])
    ), '{}') INTO v_allowed;

    UPDATE public.tasks SET disabled_tabs = v_allowed WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_task_disabled_tabs(UUID, TEXT[]) TO authenticated;
