// ─────────────────────────────────────────────────────────────────────────────
// Handover data gatherer (Phase 3).
//
// Collects a *visibility-scoped* snapshot of everything a departing project
// member contributed to / could see, ready to be rendered into an
// OVERDRAGELSESRAPPORT (handover report) PDF.
//
// The visibility scope mirrors the `allowedTabs` logic in
// pages/ProjectDetailPage.tsx exactly:
//   'all'      → everything incl. purchases/financials
//   'some'     → everything except purchases/financials
//   'standard' → tasks, punch, follow-up, reminders, time, docs (no financials)
//   'none'     → only the member's own tasks + punch items
//
// The member's own contributions (tasks, time, documentation, check-ins) are
// ALWAYS included regardless of visibility — they are *their* footprint.
// ─────────────────────────────────────────────────────────────────────────────

// Task status values come from types.ts → TaskStatus.
const STATUS_DONE = 'Udført';
const STATUS_IN_PROGRESS = 'Igangværende';
const STATUS_OVERDUE = 'Forfalden';

/**
 * Builds the JSONB-containment filter value for the `assignees` array column.
 *
 * The app stores assignees as `[{ id, initials, name, isOwner? }]` (see
 * types.ts → Task.assignees) and the DB RLS policies test membership with the
 * `@>` containment operator. PostgREST exposes `@>` as the `cs` operator, whose
 * right-hand operand must be a JSON *array* string, e.g. `[{"id":"<uuid>"}]`.
 *
 * Passing a real JS array to supabase-js `.contains()` is unsafe here: that code
 * path renders arrays with Postgres curly-brace syntax (`{[object Object]}`),
 * which does not match a JSONB array. We therefore build the JSON string
 * explicitly and apply it via `.filter('assignees', 'cs', value)` so it mirrors
 * the database's `assignees @> '[{"id":...}]'` checks exactly.
 */
export function assigneesContainmentValue(userId) {
  return JSON.stringify([{ id: userId }]);
}

/** Defensive predicate mirroring the DB `assignees @> [{ id }]` containment. */
export function isAssignedTo(assignees, userId) {
  return Array.isArray(assignees) && assignees.some((a) => a && a.id === userId);
}

/**
 * Resolves the member's *project role* (OWNER / MANAGER / EMPLOYEE) from the
 * authoritative owner relationship and the mirrored `projects.team` data,
 * instead of the resource *kind* (staff/partner). Mirrors the role mapping used
 * by the sync_projects_team_mirror() trigger.
 */
export function deriveProjectRole({ project, userId, visibility }) {
  if (project?.owner_id && String(project.owner_id) === String(userId)) return 'OWNER';
  const team = Array.isArray(project?.team) ? project.team : [];
  const entry = team.find((m) => m && String(m.id) === String(userId));
  if (entry?.role) return entry.role;
  // Fall back to the same visibility→role mapping the mirror trigger uses.
  return visibility === 'all' ? 'MANAGER' : 'EMPLOYEE';
}

/**
 * Gathers a visibility-scoped handover payload for a single member.
 *
 * @param {object}  args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseAdmin
 * @param {string}  args.projectId
 * @param {string}  args.removedUserId
 * @returns {Promise<object>} structured payload (see bottom of this function)
 */
export async function gatherHandoverData({ supabaseAdmin, projectId, removedUserId }) {
  if (!supabaseAdmin) throw new Error('gatherHandoverData: supabaseAdmin er påkrævet.');
  if (!projectId) throw new Error('gatherHandoverData: projectId er påkrævet.');
  if (!removedUserId) throw new Error('gatherHandoverData: removedUserId er påkrævet.');

  // ── a) Core entities ───────────────────────────────────────────────────────
  const [{ data: project, error: projectError },
         { data: resource },
         { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, name, project_number, client_name, address, start_date, end_date, owner_id, team')
      .eq('id', projectId)
      .maybeSingle(),
    supabaseAdmin
      .from('project_resources')
      .select('id, visibility, kind, status, created_at, joined_at, name')
      .eq('project_id', projectId)
      .eq('user_id', removedUserId)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('id', removedUserId)
      .maybeSingle(),
  ]);

  if (projectError) throw new Error(`Kunne ikke hente projekt: ${projectError.message}`);
  if (!project) throw new Error(`Projekt ikke fundet: ${projectId}`);
  if (profileError) throw new Error(`Kunne ikke hente profil: ${profileError.message}`);
  if (!profile) throw new Error(`Profil ikke fundet: ${removedUserId}`);

  // ── b) Visibility scope ──────────────────────────────────────────────────────
  // Fall back to 'standard' when no resource row exists (mirrors the EMPLOYEE
  // default in ProjectDetailPage.tsx's effectiveVisibility).
  const allowedVis = new Set(['all', 'some', 'standard', 'none']);
  const vis = allowedVis.has(resource?.visibility) ? resource.visibility : 'standard';
  const canSeeProjectOverview = vis !== 'none';

  // ── c) Always-included: member's own contributions ───────────────────────────
  // These are the member's *own footprint* and are included regardless of the
  // visibility level — including assigned purchases. Comments authored by the
  // member are gathered from the two app comment sources (tasks.comments and
  // task_documentation.comments) and filtered in JS afterwards.
  const ownContribQueries = [
    supabaseAdmin
      .from('tasks')
      .select('id, title, status, due_date, assignees, created_at')
      .eq('project_id', projectId)
      // Mirror the DB `assignees @> '[{"id":...}]'` containment check exactly.
      .filter('assignees', 'cs', assigneesContainmentValue(removedUserId)),
    supabaseAdmin
      .from('time_entries')
      .select('id, date, hours, description, task_id')
      .eq('project_id', projectId)
      .eq('user_id', removedUserId),
    supabaseAdmin
      .from('task_documentation')
      .select('id, task_id, kind, body, created_at, author_name')
      .eq('project_id', projectId)
      .eq('author_id', removedUserId),
    supabaseAdmin
      .from('task_check_ins')
      .select('id, task_id, checked_in_at, checked_out_at, auto_closed')
      .eq('project_id', projectId)
      .eq('user_id', removedUserId),
    // Purchases assigned to the member are part of their contribution history and
    // are ALWAYS loaded, independent of `visibility`.
    supabaseAdmin
      .from('purchases')
      .select('id, name, quantity, price, status, task_id')
      .eq('project_id', projectId)
      .eq('assignee_id', removedUserId),
    // Comment sources — scanned project-wide, then filtered to the member below.
    supabaseAdmin
      .from('tasks')
      .select('id, title, comments')
      .eq('project_id', projectId),
    supabaseAdmin
      .from('task_documentation')
      .select('id, task_id, comments')
      .eq('project_id', projectId),
    // Quality control checks performed by, or assigned to, the member.
    supabaseAdmin
      .from('task_quality_controls')
      .select('id, task_id, control_point, control_type, requirement_ref, result, comments, has_deviation, deviation_description, corrective_action, deviation_deadline, responsible_name, control_date, author_id, responsible_id')
      .eq('project_id', projectId)
      .or(`author_id.eq.${removedUserId},responsible_id.eq.${removedUserId}`),
  ];

  const ownResults = await Promise.all(ownContribQueries);
  const [ownTasksRes, timeRes, docsRes, checkInsRes, purchasesRes,
         tasksCommentsRes, docsCommentsRes, qualityControlsRes] = ownResults;

  const firstError = ownResults.find((r) => r?.error)?.error;
  if (firstError) throw new Error(`Kunne ikke hente bidragsdata: ${firstError.message}`);

  // Defensive: re-apply the containment predicate in JS so an imperfect
  // server-side filter can never silently undercount the member's own tasks.
  const ownTasksRaw = (ownTasksRes.data ?? []).filter((t) => isAssignedTo(t.assignees, removedUserId));
  if ((ownTasksRes.data ?? []).length !== ownTasksRaw.length) {
    console.warn(
      `gatherHandoverData: assignee filter returned ${(ownTasksRes.data ?? []).length} rows, ` +
      `${ownTasksRaw.length} matched after defensive check (project ${projectId}, user ${removedUserId}).`
    );
  }
  const timeEntriesRaw = timeRes.data ?? [];
  const documentationRaw = docsRes.data ?? [];
  const checkInsRaw = checkInsRes.data ?? [];
  const ownPurchasesRaw = purchasesRes?.data ?? [];
  const qualityControlsRaw = qualityControlsRes?.data ?? [];

  // ── d) Scoped project-level data ─────────────────────────────────────────────
  let projectStatusOverview;
  if (canSeeProjectOverview) {
    const { data: allTasks, error: allTasksError } = await supabaseAdmin
      .from('tasks')
      .select('id, status')
      .eq('project_id', projectId);
    if (allTasksError) throw new Error(`Kunne ikke hente projektopgaver: ${allTasksError.message}`);

    const tasks = allTasks ?? [];
    projectStatusOverview = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === STATUS_DONE).length,
      inProgress: tasks.filter((t) => t.status === STATUS_IN_PROGRESS).length,
      overdue: tasks.filter((t) => t.status === STATUS_OVERDUE).length,
    };
  }

  // ── e) Build structured payload ──────────────────────────────────────────────
  const ownTasks = ownTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.due_date,
  }));

  const timeEntries = timeEntriesRaw.map((e) => ({
    date: e.date,
    hours: Number(e.hours) || 0,
    description: e.description,
    taskId: e.task_id,
  }));

  const documentation = documentationRaw.map((d) => ({
    id: d.id,
    taskId: d.task_id,
    kind: d.kind,
    body: d.body,
    createdAt: d.created_at,
  }));

  const checkIns = checkInsRaw.map((c) => ({
    taskId: c.task_id,
    checkedInAt: c.checked_in_at,
    checkedOutAt: c.checked_out_at,
  }));

  const qualityControls = qualityControlsRaw.map((qc) => ({
    id: qc.id,
    taskId: qc.task_id,
    controlPoint: qc.control_point,
    controlType: qc.control_type,
    requirementRef: qc.requirement_ref,
    result: qc.result,
    comments: qc.comments,
    hasDeviation: qc.has_deviation,
    deviationDescription: qc.deviation_description,
    correctiveAction: qc.corrective_action,
    deviationDeadline: qc.deviation_deadline,
    responsibleName: qc.responsible_name,
    controlDate: qc.control_date,
  }));

  // ── Comments authored by the member ──────────────────────────────────────────
  // Two app comment sources are scanned:
  //   • tasks.comments            → { id, user, userInitials, text, timestamp, type }
  //                                  (no user id — matched by author display name)
  //   • task_documentation.comments → { id, authorId, authorName, text, createdAt }
  //                                  (matched by authorId)
  const memberName = profile.name || resource?.name || null;
  const comments = [];

  for (const t of tasksCommentsRes?.data ?? []) {
    const list = Array.isArray(t.comments) ? t.comments : [];
    for (const c of list) {
      if (c && memberName && c.user === memberName) {
        comments.push({
          source: 'task',
          taskId: t.id,
          context: t.title || null,
          text: c.text ?? '',
          type: c.type ?? 'chat',
          timeLabel: c.timestamp ?? null,
          createdAt: null,
        });
      }
    }
  }

  for (const d of docsCommentsRes?.data ?? []) {
    const list = Array.isArray(d.comments) ? d.comments : [];
    for (const c of list) {
      if (c && c.authorId === removedUserId) {
        comments.push({
          source: 'documentation',
          taskId: d.task_id,
          context: null,
          text: c.text ?? '',
          type: 'doc',
          timeLabel: null,
          createdAt: c.createdAt ?? null,
        });
      }
    }
  }

  const totalHoursLogged = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const ownTaskDoneCount = ownTasks.filter((t) => t.status === STATUS_DONE).length;

  const summaryStats = {
    ownTaskCount: ownTasks.length,
    ownTaskDoneCount,
    totalHoursLogged,
    docCount: documentation.length,
    checkInCount: checkIns.length,
    commentCount: comments.length,
    purchaseCount: ownPurchasesRaw.length,
    qualityControlCount: qualityControls.length,
  };
  if (projectStatusOverview) {
    summaryStats.projectTaskTotal = projectStatusOverview.total;
    summaryStats.projectTaskDone = projectStatusOverview.done;
  }

  const payload = {
    project: {
      id: project.id,
      name: project.name,
      projectNumber: project.project_number,
      clientName: project.client_name,
      address: project.address,
      startDate: project.start_date,
      endDate: project.end_date,
    },
    member: {
      id: profile.id,
      name: profile.name || resource?.name || profile.email || 'Ukendt',
      email: profile.email,
      // Project role (OWNER / MANAGER / EMPLOYEE) derived from the owner
      // relationship + mirrored projects.team — NOT the resource kind.
      role: deriveProjectRole({ project, userId: removedUserId, visibility: vis }),
      visibility: vis,
      // Preserve the staff/partner resource kind in case Phase 4 still needs it.
      kind: resource?.kind ?? null,
      joinedAt: resource?.joined_at ?? resource?.created_at ?? null,
    },
    visibility: vis,
    summaryStats,
    ownTasks,
    timeEntries,
    documentation,
    checkIns,
    comments,
    qualityControls,
    // Purchases assigned to the member are always part of their contributions,
    // independent of visibility.
    ownPurchases: ownPurchasesRaw.map((p) => ({
      id: p.id,
      name: p.name,
      quantity: Number(p.quantity) || 0,
      price: Number(p.price) || 0,
      status: p.status,
      taskId: p.task_id,
    })),
  };

  if (projectStatusOverview) {
    payload.projectStatusOverview = projectStatusOverview;
  }

  return payload;
}
