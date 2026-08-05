-- ============================================================================
-- BygSmart 3.0 Native — Baseline
-- SECTION 70: RLS enable + DEFINER helpers + policies + grants + realtime +
--             views + storage
-- ============================================================================
-- RLS is the sole authorisation boundary. Invariants enforced here:
--   * every helper is SECURITY DEFINER ... SET search_path = public  (inv 1)
--   * no policy reads the table it protects — always via a helper  (inv 2)
--   * views over RLS tables are security_invoker = true             (inv 3)
--   * GRANT EXECUTE ... TO authenticated only                        (inv 4)
--
-- Membership is re-derived onto project_resources (the 2.1 projects.team[] JSONB
-- mirror is gone). Soft-deleted membership rows (deleted_at) do NOT confer
-- access. The offline pull/mutation RPCs are the true sync surface and run
-- SECURITY DEFINER; these table policies back the direct PostgREST path and the
-- server's per-row adjudication.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.0  Enable RLS on every table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organizations','organization_members','org_module_entitlements',
    'projects','project_resources','resource_task_access','tasks','quick_task_access',
    'task_check_ins','task_documentation','task_handovers','task_quality_controls',
    'task_chat_messages','task_chat_reads','punch_list_layouts','punch_list_items',
    'purchases','reminders','activity_log','time_entries','time_registrations',
    'org_time_responsibles','quotations','quotation_line_items','task_budget_rates',
    'documents','document_visibility','regulations',
    'notifications','notification_preferences','push_subscriptions','logs',
    'user_connections','connection_invites','connection_requests',
    'partner_negotiation_messages','member_terminations','smtp_configs',
    'tool_access_configs','module_access_configs','org_module_prefs','org_storage_usage',
    'ai_provider_configs','ai_usage_log','ai_handover_reports_log','trial_codes',
    'demo_access_requests','project_budgets','project_budget_categories',
    'project_budget_revisions','project_budget_revision_categories'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.1  DEFINER helpers (project membership re-derived onto project_resources)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.project_resources pr
    WHERE pr.project_id = p_project_id
      AND pr.user_id = auth.uid()
      AND pr.kind = 'staff'
      AND pr.status IN ('active', 'pending')
      AND pr.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_project_role(p_project_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects p
                 WHERE p.id = p_project_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL)
      THEN 'OWNER'
    ELSE (
      SELECT CASE WHEN pr.visibility = 'all' THEN 'MANAGER' ELSE 'EMPLOYEE' END
      FROM public.project_resources pr
      WHERE pr.project_id = p_project_id
        AND pr.user_id = auth.uid()
        AND pr.kind = 'staff'
        AND pr.status IN ('active', 'pending')
        AND pr.deleted_at IS NULL
      LIMIT 1
    )
  END;
$$;

-- Profiles overexposure fix (2.1 20260628000001): a profile is visible only to a
-- caller who shares a project with that profile (both parties, same project) —
-- never "any owner sees every profile".
CREATE OR REPLACE FUNCTION public.shares_project_with_caller(p_profile_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_resources me
    JOIN public.project_resources them ON them.project_id = me.project_id
    WHERE me.user_id = auth.uid() AND me.deleted_at IS NULL
      AND them.user_id = p_profile_id AND them.deleted_at IS NULL
  )
  OR EXISTS (   -- owner shares with their own members
    SELECT 1 FROM public.projects p
    JOIN public.project_resources pr ON pr.project_id = p.id
    WHERE ((p.owner_id = auth.uid() AND pr.user_id = p_profile_id)
        OR (p.owner_id = p_profile_id AND pr.user_id = auth.uid()))
      AND p.deleted_at IS NULL AND pr.deleted_at IS NULL
  );
$$;

-- Partner (accepted) task access — canonical resource model.
CREATE OR REPLACE FUNCTION public.has_accepted_partner_task_access(p_task_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_task_access rta
    JOIN public.project_resources pr ON pr.id = rta.resource_id
    WHERE rta.task_id = p_task_id
      AND rta.deleted_at IS NULL
      AND pr.user_id = auth.uid()
      AND pr.kind = 'partner'
      AND pr.status = 'active'
      AND pr.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_partner_invite_manager(p_resource_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_resources pr
    JOIN public.projects p ON p.id = pr.project_id
    WHERE pr.id = p_resource_id
      AND (p.owner_id = auth.uid()
           OR pr.invited_by = auth.uid()
           OR public.get_user_project_role(pr.project_id) = 'MANAGER')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_partner_invite_party(p_resource_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN public.is_partner_invite_manager(p_resource_id)
      OR EXISTS (SELECT 1 FROM public.project_resources pr
                 WHERE pr.id = p_resource_id AND pr.user_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_quick_task_accessible(p_task_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id AND t.scope = 'quick' AND t.deleted_at IS NULL
      AND (
        t.owner_id = auth.uid()
        OR t.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        OR EXISTS (
          SELECT 1 FROM public.quick_task_access qta
          WHERE qta.task_id = p_task_id AND qta.user_id = auth.uid()
            AND qta.status IN ('pending', 'active') AND qta.deleted_at IS NULL
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_task_chat(p_task_id uuid, p_project_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.project_id IS NOT DISTINCT FROM p_project_id
      AND (
        (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
        OR public.has_accepted_partner_task_access(t.id)
        OR public.is_quick_task_accessible(t.id)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_document_visibility_listed(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_visibility dv
    JOIN public.project_resources pr ON pr.id = dv.resource_id
    WHERE dv.document_id = p_document_id AND dv.deleted_at IS NULL
      AND pr.user_id = auth.uid() AND pr.status = 'active' AND pr.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_project_budget(p_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_project_owner(p_project_id)
      OR public.get_user_project_role(p_project_id) = 'MANAGER'
      OR EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = p_project_id AND pr.user_id = auth.uid()
          AND pr.visibility = 'all' AND pr.status = 'active' AND pr.deleted_at IS NULL
      );
$$;

-- Org helpers.
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
      AND status = 'active' AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.created_by = auth.uid() AND o.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(p_org_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'admin');
$$;

-- Lock every helper to signed-in users only (invariant 4).
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'is_project_owner(uuid)','is_project_member(uuid)','get_user_project_role(uuid)',
    'shares_project_with_caller(uuid)','has_accepted_partner_task_access(uuid)',
    'is_partner_invite_manager(uuid)','is_partner_invite_party(uuid)',
    'is_quick_task_accessible(uuid)','can_access_task_chat(uuid,uuid)',
    'is_document_visibility_listed(uuid)','can_view_project_budget(uuid)',
    'is_org_member(uuid)','is_org_owner(uuid)','get_org_role(uuid)','is_admin()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated;', fn);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.1b  TABLE PRIVILEGES.  RLS is the ROW gate, but a role still needs
--   table-level privileges to attempt access at all. Supabase's provisioned
--   projects grant these to authenticated by default; the baseline makes it
--   EXPLICIT so the schema is self-contained and portable (a `DROP SCHEMA public`
--   or a non-Supabase Postgres does not silently leave every table 42501). RLS
--   then restricts rows — and the 54 tables all have RLS enabled, so a table
--   with no policy stays fully denied even with the grant. `anon` gets nothing:
--   every path in this app requires authentication.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.2  Policies — IDENTITY
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY profiles_select_own       ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_select_connected ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_connections
                 WHERE user_id = auth.uid() AND connected_user_id = id));
CREATE POLICY profiles_select_shared_project ON public.profiles FOR SELECT
  USING (public.shares_project_with_caller(id));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY organizations_select_member ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id) OR created_by = auth.uid());
CREATE POLICY organizations_update_owner_admin ON public.organizations FOR UPDATE TO authenticated
  USING (public.get_org_role(id) IN ('owner', 'admin'))
  WITH CHECK (public.get_org_role(id) IN ('owner', 'admin'));

CREATE POLICY org_members_select_member ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
CREATE POLICY org_members_insert_admin ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.get_org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY org_members_update_admin ON public.organization_members FOR UPDATE TO authenticated
  USING (public.get_org_role(org_id) IN ('owner', 'admin'))
  WITH CHECK (public.get_org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY org_members_delete_admin_or_self ON public.organization_members FOR DELETE TO authenticated
  USING (public.get_org_role(org_id) IN ('owner', 'admin') OR user_id = auth.uid());

CREATE POLICY ome_select_member ON public.org_module_entitlements FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.3  Policies — PROJECT GRAPH
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY projects_select_member ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id));
CREATE POLICY projects_select_org_admin ON public.projects FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.get_org_role(org_id) IN ('owner', 'admin'));
CREATE POLICY projects_insert_own ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY projects_update_owner_manager ON public.projects FOR UPDATE TO authenticated
  USING (public.is_project_owner(id) OR public.get_user_project_role(id) = 'MANAGER')
  WITH CHECK (public.is_project_owner(id) OR public.get_user_project_role(id) = 'MANAGER');
CREATE POLICY projects_delete_owner ON public.projects FOR DELETE TO authenticated
  USING (public.is_project_owner(id));

CREATE POLICY pr_select ON public.project_resources FOR SELECT TO authenticated
  USING (public.is_project_owner(project_id) OR public.is_project_member(project_id) OR user_id = auth.uid());
CREATE POLICY pr_insert_manager ON public.project_resources FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY pr_update_manager ON public.project_resources FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER')
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY pr_update_self ON public.project_resources FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY pr_delete_manager ON public.project_resources FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

CREATE POLICY rta_select_party ON public.resource_task_access FOR SELECT TO authenticated
  USING (public.is_partner_invite_party(resource_id));
CREATE POLICY rta_insert_manager ON public.resource_task_access FOR INSERT TO authenticated
  WITH CHECK (public.is_partner_invite_manager(resource_id)
    AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.project_resources pr ON pr.id = resource_id
                WHERE t.id = task_id AND t.project_id = pr.project_id));
CREATE POLICY rta_update_manager ON public.resource_task_access FOR UPDATE TO authenticated
  USING (public.is_partner_invite_manager(resource_id))
  WITH CHECK (public.is_partner_invite_manager(resource_id));
CREATE POLICY rta_delete_manager ON public.resource_task_access FOR DELETE TO authenticated
  USING (public.is_partner_invite_manager(resource_id));

-- tasks: project scope + quick scope + partner scope
CREATE POLICY tasks_select_project ON public.tasks FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND public.is_project_member(project_id));
CREATE POLICY tasks_select_partner ON public.tasks FOR SELECT TO authenticated
  USING (public.has_accepted_partner_task_access(id));
CREATE POLICY tasks_select_quick ON public.tasks FOR SELECT TO authenticated
  USING (scope = 'quick' AND public.is_quick_task_accessible(id));
CREATE POLICY tasks_insert_project ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (project_id IS NOT NULL
    AND (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER'));
CREATE POLICY tasks_insert_quick ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (scope = 'quick' AND project_id IS NULL AND owner_id = auth.uid());
CREATE POLICY tasks_update_project ON public.tasks FOR UPDATE TO authenticated
  USING (project_id IS NOT NULL AND (
    public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER'
    OR EXISTS (SELECT 1 FROM public.project_resources pr
               WHERE pr.project_id = tasks.project_id AND pr.user_id = auth.uid()
                 AND pr.visibility = 'all' AND pr.status IN ('pending','active') AND pr.deleted_at IS NULL)
    OR (EXISTS (SELECT 1 FROM public.project_resources pr
                WHERE pr.project_id = tasks.project_id AND pr.user_id = auth.uid()
                  AND pr.visibility IN ('standard','some') AND pr.status IN ('pending','active') AND pr.deleted_at IS NULL)
        AND tasks.assignees @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text)))
  ));
CREATE POLICY tasks_update_quick ON public.tasks FOR UPDATE TO authenticated
  USING (scope = 'quick' AND public.is_quick_task_accessible(id));
CREATE POLICY tasks_delete_project ON public.tasks FOR DELETE TO authenticated
  USING (project_id IS NOT NULL AND (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER'));
CREATE POLICY tasks_delete_quick ON public.tasks FOR DELETE TO authenticated
  USING (scope = 'quick' AND owner_id = auth.uid());

CREATE POLICY qta_select ON public.quick_task_access FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'));
CREATE POLICY qta_insert ON public.quick_task_access FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'));
CREATE POLICY qta_update ON public.quick_task_access FOR UPDATE TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'))
  WITH CHECK (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'));
CREATE POLICY qta_delete ON public.quick_task_access FOR DELETE TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id = auth.uid() AND t.scope = 'quick'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.4  Policies — FIELD/WORK (task_documentation, check_ins, handovers, qc, chat)
--       Common shape: member OR accepted-partner OR quick-task-accessible.
-- ─────────────────────────────────────────────────────────────────────────────
-- task_documentation
CREATE POLICY task_docs_select ON public.task_documentation FOR SELECT TO authenticated
  USING ((project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id));
CREATE POLICY task_docs_insert ON public.task_documentation FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id)));
CREATE POLICY task_docs_update_own ON public.task_documentation FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY task_docs_update_mgr ON public.task_documentation FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER')
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY task_docs_delete ON public.task_documentation FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- task_check_ins
CREATE POLICY checkins_select ON public.task_check_ins FOR SELECT TO authenticated
  USING ((project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id));
CREATE POLICY checkins_insert ON public.task_check_ins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id)));
CREATE POLICY checkins_update_own ON public.task_check_ins FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY checkins_delete ON public.task_check_ins FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- task_handovers (transitions further guarded by guard_task_handover_op trigger)
CREATE POLICY handovers_select ON public.task_handovers FOR SELECT TO authenticated
  USING ((project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id));
CREATE POLICY handovers_insert ON public.task_handovers FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id)));
CREATE POLICY handovers_update ON public.task_handovers FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY handovers_delete ON public.task_handovers FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- task_quality_controls
CREATE POLICY qc_select ON public.task_quality_controls FOR SELECT TO authenticated
  USING ((project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id));
CREATE POLICY qc_insert ON public.task_quality_controls FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR public.has_accepted_partner_task_access(task_id) OR public.is_quick_task_accessible(task_id)));
CREATE POLICY qc_update ON public.task_quality_controls FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER')
  WITH CHECK (author_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY qc_delete ON public.task_quality_controls FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- task_chat_messages + reads
CREATE POLICY chat_select ON public.task_chat_messages FOR SELECT TO authenticated
  USING (public.can_access_task_chat(task_id, project_id));
CREATE POLICY chat_insert ON public.task_chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_task_chat(task_id, project_id));
CREATE POLICY chat_update_own ON public.task_chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY chat_delete ON public.task_chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

CREATE POLICY chat_reads_select_own ON public.task_chat_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY chat_reads_insert_own ON public.task_chat_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
    AND public.can_access_task_chat(task_id, (SELECT t.project_id FROM public.tasks t WHERE t.id = task_id)));
CREATE POLICY chat_reads_update_own ON public.task_chat_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.5  Policies — project-scoped simple tables (member read/write; owner/mgr delete)
-- ─────────────────────────────────────────────────────────────────────────────
-- purchases
CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
CREATE POLICY purchases_write ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) IN ('MANAGER','EMPLOYEE'));
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) IN ('MANAGER','EMPLOYEE'));
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- reminders / punch layouts / punch items — member ALL
CREATE POLICY reminders_all ON public.reminders FOR ALL TO authenticated
  USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
CREATE POLICY punch_layouts_all ON public.punch_list_layouts FOR ALL TO authenticated
  USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));
CREATE POLICY punch_items_all ON public.punch_list_items FOR ALL TO authenticated
  USING (public.is_project_member(project_id)) WITH CHECK (public.is_project_member(project_id));

-- activity_log — member select/insert (append feed)
CREATE POLICY activity_select ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
CREATE POLICY activity_insert ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));

-- time_entries (project members + accepted partners on their tasks)
CREATE POLICY time_entries_select ON public.time_entries FOR SELECT TO authenticated
  USING ((project_id IS NOT NULL AND public.is_project_member(project_id))
    OR (task_id IS NOT NULL AND public.has_accepted_partner_task_access(task_id)));
CREATE POLICY time_entries_insert_own ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (
    (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR (task_id IS NOT NULL AND public.has_accepted_partner_task_access(task_id))));
CREATE POLICY time_entries_update_own ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY time_entries_delete ON public.time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

-- time_registrations (own; submitted visible to responsible/org owner)
CREATE POLICY time_reg_select ON public.time_registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR (status <> 'draft' AND public.is_org_member(org_id)
        AND (responsible_id = auth.uid() OR public.is_org_owner(org_id))));
CREATE POLICY time_reg_insert ON public.time_registrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY time_reg_update ON public.time_registrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft', 'rejected')) WITH CHECK (user_id = auth.uid());
CREATE POLICY time_reg_delete ON public.time_registrations FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY otr_select ON public.org_time_responsibles FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY otr_insert ON public.org_time_responsibles FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(org_id));
CREATE POLICY otr_update ON public.org_time_responsibles FOR UPDATE TO authenticated
  USING (public.is_org_owner(org_id)) WITH CHECK (public.is_org_owner(org_id));
CREATE POLICY otr_delete ON public.org_time_responsibles FOR DELETE TO authenticated
  USING (public.is_org_owner(org_id));

-- quotations + line items (member read; owner/manager write)
CREATE POLICY quotations_select ON public.quotations FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
CREATE POLICY quotations_write ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY quotations_update ON public.quotations FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY quotations_delete ON public.quotations FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

CREATE POLICY qli_select ON public.quotation_line_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id AND public.is_project_member(q.project_id)));
CREATE POLICY qli_write ON public.quotation_line_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id
             AND (public.is_project_owner(q.project_id) OR public.get_user_project_role(q.project_id) = 'MANAGER')));
CREATE POLICY qli_update ON public.quotation_line_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id
         AND (public.is_project_owner(q.project_id) OR public.get_user_project_role(q.project_id) = 'MANAGER')));
CREATE POLICY qli_delete ON public.quotation_line_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_id
         AND (public.is_project_owner(q.project_id) OR public.get_user_project_role(q.project_id) = 'MANAGER')));

-- task_budget_rates — read via budget rule; writes only via SECURITY DEFINER RPC.
CREATE POLICY task_budget_rates_select ON public.task_budget_rates FOR SELECT TO authenticated
  USING (public.can_view_project_budget(project_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.6  Policies — DOCUMENTS + visibility + regulations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.get_user_project_role(project_id) = 'MANAGER'
    OR (access_level = 'public_team' AND EXISTS (
        SELECT 1 FROM public.project_resources pr
        WHERE pr.project_id = documents.project_id AND pr.user_id = auth.uid()
          AND pr.status = 'active' AND pr.visibility IN ('all','some','standard') AND pr.deleted_at IS NULL))
    OR (access_level = 'custom_users' AND public.is_document_visibility_listed(id))
  );
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id));
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id) OR public.get_user_project_role(project_id) = 'MANAGER');

CREATE POLICY doc_vis_select ON public.document_visibility FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
    public.is_project_owner(d.project_id) OR public.get_user_project_role(d.project_id) = 'MANAGER'
    OR public.is_document_visibility_listed(document_id))));
CREATE POLICY doc_vis_write ON public.document_visibility FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
    public.is_project_owner(d.project_id) OR public.get_user_project_role(d.project_id) = 'MANAGER')));
CREATE POLICY doc_vis_update ON public.document_visibility FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
    public.is_project_owner(d.project_id) OR public.get_user_project_role(d.project_id) = 'MANAGER')));
CREATE POLICY doc_vis_delete ON public.document_visibility FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND (
    public.is_project_owner(d.project_id) OR public.get_user_project_role(d.project_id) = 'MANAGER')));

CREATE POLICY regulations_select_all ON public.regulations FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY regulations_insert_service ON public.regulations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.7  Policies — BACK-OFFICE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY notifications_own ON public.notifications FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_prefs_own ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_select_own ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_delete_own ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY push_service ON public.push_subscriptions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY logs_select_own ON public.logs FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY logs_insert_own ON public.logs FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY logs_delete_own ON public.logs FOR DELETE USING (user_id = auth.uid());

CREATE POLICY conn_select_own ON public.user_connections FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = connected_user_id);
CREATE POLICY conn_insert_own ON public.user_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY conn_delete_own ON public.user_connections FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY conn_invites_insert ON public.connection_invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY conn_invites_select ON public.connection_invites FOR SELECT TO authenticated USING (auth.uid() = inviter_id);

CREATE POLICY conn_req_select_sender   ON public.connection_requests FOR SELECT TO authenticated USING (auth.uid() = from_user_id);
CREATE POLICY conn_req_select_receiver ON public.connection_requests FOR SELECT TO authenticated USING (auth.uid() = to_user_id);
CREATE POLICY conn_req_insert   ON public.connection_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY conn_req_update   ON public.connection_requests FOR UPDATE TO authenticated USING (auth.uid() = to_user_id);
CREATE POLICY conn_req_delete   ON public.connection_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY pnm_select ON public.partner_negotiation_messages FOR SELECT TO authenticated
  USING (public.is_partner_invite_party(resource_id));
CREATE POLICY pnm_insert ON public.partner_negotiation_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_partner_invite_party(resource_id)
    AND EXISTS (SELECT 1 FROM public.project_resources pr WHERE pr.id = resource_id AND pr.status IN ('pending','active')));

CREATE POLICY member_term_select ON public.member_terminations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = member_terminations.project_id AND p.owner_id = auth.uid())
    OR public.is_admin());
CREATE POLICY ai_handover_log_select ON public.ai_handover_reports_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = ai_handover_reports_log.project_id AND p.owner_id = auth.uid())
    OR public.is_admin());

-- Admin-only config tables (service role bypasses RLS at runtime).
CREATE POLICY smtp_admin_all ON public.smtp_configs FOR ALL
  USING (scope = 'global' AND public.is_admin()) WITH CHECK (scope = 'global' AND public.is_admin());
CREATE POLICY smtp_owner_own ON public.smtp_configs FOR ALL
  USING (owner_id = auth.uid() AND scope = 'custom') WITH CHECK (owner_id = auth.uid() AND scope = 'custom');
CREATE POLICY tool_access_admin ON public.tool_access_configs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY module_access_admin ON public.module_access_configs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ai_provider_admin ON public.ai_provider_configs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ai_usage_admin_select ON public.ai_usage_log FOR SELECT USING (public.is_admin());
CREATE POLICY trial_codes_admin ON public.trial_codes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY demo_requests_service ON public.demo_access_requests FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY omp_select_member ON public.org_module_prefs FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY omp_insert_owner ON public.org_module_prefs FOR INSERT TO authenticated WITH CHECK (public.get_org_role(org_id) = 'owner');
CREATE POLICY omp_update_owner ON public.org_module_prefs FOR UPDATE TO authenticated
  USING (public.get_org_role(org_id) = 'owner') WITH CHECK (public.get_org_role(org_id) = 'owner');
CREATE POLICY omp_delete_owner ON public.org_module_prefs FOR DELETE TO authenticated USING (public.get_org_role(org_id) = 'owner');

CREATE POLICY org_storage_select ON public.org_storage_usage FOR SELECT TO authenticated USING (public.is_org_member(org_id));

-- Budget ledger: read via budget rule; NO write policies (RPC/service-role only).
CREATE POLICY project_budgets_select ON public.project_budgets FOR SELECT TO authenticated
  USING (public.can_view_project_budget(project_id));
CREATE POLICY pbc_select ON public.project_budget_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_budgets pb WHERE pb.id = project_budget_id AND public.can_view_project_budget(pb.project_id)));
CREATE POLICY pbr_select ON public.project_budget_revisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_budgets pb WHERE pb.id = project_budget_id AND public.can_view_project_budget(pb.project_id)));
CREATE POLICY pbrc_select ON public.project_budget_revision_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_budget_revisions r JOIN public.project_budgets pb ON pb.id = r.project_budget_id
                 WHERE r.id = revision_id AND public.can_view_project_budget(pb.project_id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.8  Views  (security_invoker — invariant 3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.projects_summary
WITH (security_invoker = true) AS
SELECT
  p.id, p.name, p.status, p.progress, p.start_date, p.end_date, p.is_favorite,
  p.owner_id, p.project_number, p.client_name,
  (SELECT COUNT(*) FROM public.project_resources pr
     WHERE pr.project_id = p.id AND pr.kind = 'staff' AND pr.deleted_at IS NULL) AS team_size,
  (SELECT COUNT(*) FROM public.tasks t
     WHERE t.project_id = p.id AND t.status <> 'Udført' AND t.deleted_at IS NULL) AS open_tasks,
  (SELECT COUNT(*) FROM public.tasks t
     WHERE t.project_id = p.id AND t.status = 'Forfalden' AND t.deleted_at IS NULL) AS overdue_tasks,
  p.created_at, p.updated_at
FROM public.projects p
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.admin_handover_reports_v
WITH (security_invoker = true) AS
SELECT id, project_id, 'task_handover'::text AS source, status, submitted_by AS actor_id, created_at
  FROM public.task_handovers
UNION ALL
SELECT id, project_id, 'member_termination'::text, NULL::text, removed_by, created_at
  FROM public.member_terminations
UNION ALL
SELECT id, project_id, 'ai_handover'::text, NULL::text, generated_by, generated_at
  FROM public.ai_handover_reports_log;

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.9  Realtime publication — SYNCABLE tables only
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organizations','organization_members','org_module_entitlements',
    'projects','project_resources','resource_task_access','tasks','quick_task_access',
    'task_check_ins','task_documentation','task_handovers','task_quality_controls',
    'task_chat_messages','task_chat_reads','punch_list_layouts','punch_list_items',
    'purchases','reminders','activity_log','time_entries','time_registrations',
    'org_time_responsibles','quotations','quotation_line_items','task_budget_rates',
    'documents','document_visibility','sync_tombstones'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 70.10  Storage — task-docs private bucket + object-level policies
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-docs', 'task-docs', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_taskdocs_project_member(object_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_seg1 text; v_proj uuid;
BEGIN
  v_seg1 := split_part(object_name, '/', 1);
  IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN false; END IF;
  BEGIN v_proj := v_seg1::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  RETURN public.is_project_member(v_proj);
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_taskdocs_accepted_partner(object_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_seg1 text; v_seg2 text; v_task uuid;
BEGIN
  v_seg1 := split_part(object_name, '/', 1);
  IF v_seg1 = 'signatures' OR v_seg1 = '' THEN RETURN false; END IF;
  v_seg2 := split_part(object_name, '/', 2);
  IF v_seg2 = '' THEN RETURN false; END IF;
  BEGIN v_task := v_seg2::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  RETURN public.has_accepted_partner_task_access(v_task);
END;
$$;

REVOKE ALL ON FUNCTION public.storage_taskdocs_project_member(text)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_taskdocs_accepted_partner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_taskdocs_project_member(text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_taskdocs_accepted_partner(text) TO authenticated;

CREATE POLICY task_docs_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-docs' AND (
    (split_part(name, '/', 1) = 'signatures' AND split_part(name, '/', 2) = (auth.uid())::text)
    OR public.storage_taskdocs_project_member(name)
    OR public.storage_taskdocs_accepted_partner(name)));
CREATE POLICY task_docs_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-docs' AND (
    (split_part(name, '/', 1) = 'signatures' AND split_part(name, '/', 2) = (auth.uid())::text)
    OR public.storage_taskdocs_project_member(name)
    OR public.storage_taskdocs_accepted_partner(name)));
CREATE POLICY task_docs_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'task-docs' AND (
    (split_part(name, '/', 1) = 'signatures' AND split_part(name, '/', 2) = (auth.uid())::text)
    OR public.storage_taskdocs_project_member(name)));
CREATE POLICY task_docs_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-docs' AND (
    (split_part(name, '/', 1) = 'signatures' AND split_part(name, '/', 2) = (auth.uid())::text)
    OR public.storage_taskdocs_project_member(name)));
