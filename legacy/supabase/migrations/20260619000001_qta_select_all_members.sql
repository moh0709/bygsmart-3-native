-- ============================================================
-- MIGRATION: Widen qta_select policy so all task participants
-- (owner OR any pending/active member) can read the full
-- quick_task_access list for that task.
-- Uses a SECURITY DEFINER helper to avoid RLS self-recursion.
-- ============================================================

DROP POLICY IF EXISTS "qta_select" ON public.quick_task_access;

-- Helper: returns true if auth.uid() is the quick-task owner or has a
-- pending/active access row. SECURITY DEFINER bypasses RLS on its own
-- table read, breaking the recursion that would occur if the policy
-- queried public.quick_task_access directly.
CREATE OR REPLACE FUNCTION public.is_quick_task_participant(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'
  ) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quick_task_access qta
    WHERE qta.task_id = p_task_id
      AND qta.user_id = auth.uid()
      AND qta.status IN ('pending', 'active')
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE POLICY "qta_select" ON public.quick_task_access
  FOR SELECT TO authenticated
  USING (public.is_quick_task_participant(task_id));
