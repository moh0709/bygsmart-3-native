import { Task, ProjectMember, ResourceKind, ResourceVisibility } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { TASK_COLUMNS, TaskRow } from '../../../services/api/columns';
import { getProjectById, getProjects } from '../../projects';

// --- TASKS ---

export const mapTask = (t: (TaskRow & { project_name?: string; owner_id?: string }) | any): Task => ({
    id: t.id,
    projectId: (t as any).project_id ?? undefined,
    title: t.title,
    status: t.status as Task['status'],
    priority: ((t as any).priority as Task['priority']) ?? 'Mellem',
    dueDate: t.due_date ?? '',
    projectName: t.project_name ?? undefined,
    relatedLink: (t.related_link as unknown as Task['relatedLink']) ?? undefined,
    assignees: (t.assignees as unknown as Task['assignees']) ?? [],
    description: t.description ?? '',
    checklist: (t.checklist as unknown as Task['checklist']) ?? [],
    attachments: (t.attachments as unknown as Task['attachments']) ?? [],
    comments: (t.comments as unknown as Task['comments']) ?? [],
    isMilestone: t.is_milestone ?? false,
    suggestedRegulations: (t.suggested_regulations as unknown as Task['suggestedRegulations']) ?? [],
    ownerId: t.owner_id ?? undefined,
    projectTeam: (t.project_team as unknown as ProjectMember[]) ?? undefined,
    estimatedHours: t.estimated_hours ?? 0,
    dependencies: (t.dependencies as unknown as Task['dependencies']) ?? [],
    step: t.step ?? undefined,
    handoverStatus: ((t as any).handover_status as Task['handoverStatus']) ?? 'none',
    completedAt: (t as any).completed_at ?? undefined,
    acceptanceReportPath: (t as any).acceptance_report_path ?? undefined,
    scope: ((t as any).scope as Task['scope']) ?? 'project',
    archivedAt: (t as any).archived_at ?? undefined,
    createdAt: (t as any).created_at ?? undefined,
    disabledTabs: ((t as any).disabled_tabs as Task['disabledTabs']) ?? [],
});

export const getAllTasksForActiveProjects = async (userId?: string): Promise<Task[]> => {
    let projectIds: string[] | undefined;

    if (userId) {
        const projects = await getProjects(userId);
        if (projects.length === 0) return [];
        projectIds = projects.map(p => p.id);
    }

    let query: any = supabase
        .from('tasks')
        .select(TASK_COLUMNS + ', projects!inner(name, status)')
        .eq('projects.status', 'I gang')
        .is('archived_at', null);

    if (projectIds) {
        query = query.in('project_id', projectIds);
    }

    const { data, error } = await query;
    if (error) { console.error('getAllTasksForActiveProjects error:', error); return []; }

    return (data ?? []).map((t: any) => mapTask({ ...t, project_name: t.projects?.name }));
};

export const getTasksForProject = async (projectId: string, userId?: string, includeArchived = false): Promise<Task[]> => {
    let query = supabase
        .from('tasks')
        .select(TASK_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    if (!includeArchived) {
        query = query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) { console.error('getTasksForProject error:', error); return []; }

    let tasks = (data ?? []).map(mapTask);

    if (userId) {
        const { data: resRow } = await (supabase as any)
            .from('project_resources')
            .select('visibility, kind, status')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .maybeSingle();

        if (resRow) {
            const { visibility, kind, status } = resRow;
            if (kind === 'partner') {
                // Pending partner invitees cannot see any tasks until they accept
                tasks = status === 'active'
                    ? tasks.filter(t => (t.assignees ?? []).some((a: any) => a.id === userId))
                    : [];
            } else if (visibility !== 'all') {
                tasks = tasks.filter(t =>
                    (t.assignees ?? []).some((a: any) => a.id === userId)
                );
            }
        } else {
            // Legacy team role fallback
            const project = await getProjectById(projectId);
            if (project) {
                const member = project.team.find((m: ProjectMember) => m.id === userId);
                if (member && (member.role === 'EXTERNAL' || !['OWNER', 'MANAGER'].includes(member.role))) {
                    tasks = tasks.filter(t =>
                        (t.assignees ?? []).some((a: any) => a.id === userId)
                    );
                }
            }
        }
    }

    return tasks;
};

export const getTaskById = async (id: string): Promise<Task | undefined> => {
    // Use left join hint so quick tasks (project_id IS NULL) are still returned.
    const { data, error } = await supabase
        .from('tasks')
        .select(TASK_COLUMNS + ', projects!left(owner_id, team)')
        .eq('id', id)
        .maybeSingle();
    if (error) { console.error('getTaskById error:', error); return undefined; }
    if (!data) return undefined;
    const row = data as any;
    return mapTask({
        ...row,
        owner_id: row.projects?.owner_id ?? row.owner_id ?? undefined,
        project_team: row.projects?.team ?? [],
    });
};

// Keeps resource_task_access in sync whenever task assignees change.
// For each partner resource whose user_id is in assigneeIds, an access row is upserted.
// Rows for partner resources that are no longer assignees are removed.
const syncResourceTaskAccess = async (taskId: string, projectId: string | null | undefined, assigneeIds: string[]): Promise<void> => {
    if (!projectId) {
        // Quick tasks: sync quick_task_access instead of resource_task_access
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: existingRows } = await (supabase as any)
            .from('quick_task_access')
            .select('user_id')
            .eq('task_id', taskId);

        const existingSet = new Set(((existingRows ?? []) as any[]).map((r: any) => r.user_id as string));
        const assigneeSet = new Set(assigneeIds);

        // Add access rows for newly assigned users (skip the task owner)
        const toAdd = assigneeIds.filter(id => id !== user.id && !existingSet.has(id));
        // Remove access for users no longer assigned (skip the task owner)
        const toRemove = [...existingSet].filter(uid => !assigneeSet.has(uid) && uid !== user.id);

        if (toAdd.length > 0) {
            await (supabase as any)
                .from('quick_task_access')
                .upsert(
                    toAdd.map(uid => ({ task_id: taskId, user_id: uid, invited_by: user.id })),
                    { onConflict: 'task_id,user_id' }
                );
        }
        if (toRemove.length > 0) {
            await (supabase as any)
                .from('quick_task_access')
                .delete()
                .eq('task_id', taskId)
                .in('user_id', toRemove);
        }
        return;
    }

    // Project tasks: sync resource_task_access for partner resources
    const { data: partnerResources } = await (supabase as any)
        .from('project_resources')
        .select('id, user_id')
        .eq('project_id', projectId)
        .eq('kind', 'partner')
        .in('status', ['pending', 'active']);
    if (!partnerResources || partnerResources.length === 0) return;

    const assigneeSet = new Set(assigneeIds);
    const toAdd = partnerResources.filter((r: any) => assigneeSet.has(r.user_id));
    const toRemove = partnerResources.filter((r: any) => !assigneeSet.has(r.user_id));

    if (toAdd.length > 0) {
        await (supabase as any)
            .from('resource_task_access')
            .upsert(
                toAdd.map((r: any) => ({ task_id: taskId, resource_id: r.id })),
                { onConflict: 'task_id,resource_id' }
            );
    }
    if (toRemove.length > 0) {
        await (supabase as any)
            .from('resource_task_access')
            .delete()
            .eq('task_id', taskId)
            .in('resource_id', toRemove.map((r: any) => r.id));
    }
};

const sendTaskInviteNotifications = async (
    taskId: string,
    taskTitle: string,
    projectId: string,
    projectName: string,
    assigneeIds: string[],
    projectTeamUserIds: Set<string>,
    currentUserId: string,
    currentUserName: string,
    currentUserInitials: string,
    currentUserTeamId: string | null,
    taskStep?: string | null,
): Promise<void> => {
    if (assigneeIds.length === 0) return;

    // Load existing project_resources rows (pending or active) for this project and these assignees
    // so we can skip assignees that are already tracked as members.
    const { data: existingResources } = await (supabase as any)
        .from('project_resources')
        .select('user_id')
        .eq('project_id', projectId)
        .in('user_id', assigneeIds)
        .in('status', ['pending', 'active']);
    const existingResourceUserIds = new Set(
        ((existingResources ?? []) as any[]).map((r: any) => r.user_id as string)
    );

    for (const assigneeId of assigneeIds) {
        if (assigneeId === currentUserId) continue;
        // Skip if already tracked in project_resources (pending/active) or legacy team mirror
        if (existingResourceUserIds.has(assigneeId) || projectTeamUserIds.has(assigneeId)) continue;

        const { data: assigneeProfile } = await (supabase as any)
            .from('profiles')
            .select('name, initials, email, team_id')
            .eq('id', assigneeId)
            .maybeSingle();
        const assigneeTeamId = assigneeProfile?.team_id ?? null;
        const memberKind: ResourceKind =
            currentUserTeamId && assigneeTeamId && currentUserTeamId === assigneeTeamId
                ? 'staff'
                : 'partner';
        const memberVisibility: ResourceVisibility = memberKind === 'staff' ? 'standard' : 'none';

        // Create the pending project_resources row BEFORE writing the notification so that
        // syncResourceTaskAccess (called after this function returns) finds the row and
        // creates the resource_task_access allowlist entry immediately.
        const { error: resourceErr } = await (supabase as any).from('project_resources').insert({
            project_id: projectId,
            user_id: assigneeId,
            name: assigneeProfile?.name ?? 'Ukendt',
            initials: assigneeProfile?.initials ?? 'XX',
            email: assigneeProfile?.email ?? null,
            kind: memberKind,
            visibility: memberVisibility,
            status: 'pending',
            invited_by: currentUserId,
        });
        if (resourceErr && resourceErr.code !== '23505') {
            // Log but do not abort — the invite notification is still useful even if
            // the resource row could not be created (e.g. caller lacks manager rights).
            console.warn('sendTaskInviteNotifications: could not create resource row for', assigneeId, resourceErr.message);
        }

        await (supabase as any).from('notifications').insert({
            user_id: assigneeId,
            text: `Du er inviteret til opgaven "${taskTitle}" i projektet "${projectName}"`,
            timestamp: new Date().toISOString(),
            is_read: false,
            type: 'task_invite',
            link: `/project-detail/${projectId}?tab=opgaver`,
            metadata: {
                task_id: taskId,
                project_id: projectId,
                task_title: taskTitle,
                task_step: taskStep ?? null,
                project_name: projectName,
                inviter_name: currentUserName,
                inviter_initials: currentUserInitials,
                member_kind: memberKind,
            },
        });
    }
};

export const createTaskForProject = async (projectId: string, task: Partial<Task>): Promise<Task> => {
    const { data, error } = await supabase
        .from('tasks')
        .insert({
            project_id: projectId,
            title: task.title ?? 'Ny opgave',
            status: task.status || 'To Do',
            priority: task.priority || 'Mellem',
            due_date: task.dueDate || null,
            related_link: task.relatedLink || null,
            assignees: (task.assignees || []) as any,
            description: task.description || '',
            checklist: (task.checklist || []) as any,
            attachments: (task.attachments || []) as any,
            comments: (task.comments || []) as any,
            is_milestone: task.isMilestone || false,
            suggested_regulations: (task.suggestedRegulations || []) as any,
            estimated_hours: task.estimatedHours || 0,
            dependencies: (task.dependencies || []) as any,
            step: task.step || null,
        })
        .select()
        .single();
    if (error) { console.error('createTaskForProject error:', error); throw error; }
    const created = mapTask(data);
    const assigneeIds = (task.assignees || []).map((a: any) => a.id ?? a).filter(Boolean);

    void (async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;
            const { data: currentProfile } = await (supabase as any)
                .from('profiles')
                .select('name, initials, team_id')
                .eq('id', authUser.id)
                .maybeSingle();
            const project = await getProjectById(projectId);
            if (!project || !currentProfile) return;
            const projectTeamUserIds = new Set(project.team.map((m: ProjectMember) => m.id));
            // sendTaskInviteNotifications creates pending project_resources rows first,
            // so syncResourceTaskAccess runs after and finds them for the allowlist.
            await sendTaskInviteNotifications(
                created.id,
                created.title,
                projectId,
                project.name,
                assigneeIds,
                projectTeamUserIds,
                authUser.id,
                currentProfile.name ?? '',
                currentProfile.initials ?? '',
                currentProfile.team_id ?? null,
                created.step ?? null,
            );
            await syncResourceTaskAccess(created.id, projectId, assigneeIds);
        } catch (e) {
            console.error('createTaskForProject notification error:', e);
        }
    })();

    return created;
};

export const updateTask = async (task: Task): Promise<boolean> => {
    const { data: existingTask } = await supabase
        .from('tasks')
        .select('assignees')
        .eq('id', task.id)
        .maybeSingle();
    const existingAssigneeIds = new Set<string>(
        ((existingTask?.assignees as any[]) ?? []).map((a: any) => a.id ?? a).filter(Boolean)
    );

    const { data, error } = await supabase
        .from('tasks')
        .update({
            title: task.title,
            status: task.status,
            priority: task.priority || 'Mellem',
            due_date: task.dueDate || null,
            related_link: task.relatedLink || null,
            assignees: (task.assignees || []) as any,
            description: task.description || '',
            checklist: (task.checklist || []) as any,
            attachments: (task.attachments || []) as any,
            comments: (task.comments || []) as any,
            is_milestone: task.isMilestone || false,
            suggested_regulations: (task.suggestedRegulations || []) as any,
            estimated_hours: task.estimatedHours || 0,
            step: task.step || null,
            dependencies: (task.dependencies || []) as any,
        })
        .eq('id', task.id)
        .select('id')
        .maybeSingle();
    if (error || !data) { console.error('updateTask error:', error); return false; }
    const assigneeIds = (task.assignees || []).map((a: any) => a.id ?? a).filter(Boolean);
    const newAssigneeIds = assigneeIds.filter((id: string) => !existingAssigneeIds.has(id));

    if (newAssigneeIds.length > 0 && task.projectId) {
        // New assignees: create their pending project_resources rows first (via
        // sendTaskInviteNotifications), then sync the full task allowlist so the
        // newly-created rows are included.
        void (async () => {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) return;
                const { data: currentProfile } = await (supabase as any)
                    .from('profiles')
                    .select('name, initials, team_id')
                    .eq('id', authUser.id)
                    .maybeSingle();
                const project = await getProjectById(task.projectId!);
                if (!project || !currentProfile) return;
                const projectTeamUserIds = new Set(project.team.map((m: ProjectMember) => m.id));
                await sendTaskInviteNotifications(
                    task.id,
                    task.title,
                    task.projectId!,
                    project.name,
                    newAssigneeIds,
                    projectTeamUserIds,
                    authUser.id,
                    currentProfile.name ?? '',
                    currentProfile.initials ?? '',
                    currentProfile.team_id ?? null,
                    task.step ?? null,
                );
                // Sync full assignee list after resource rows exist
                await syncResourceTaskAccess(task.id, task.projectId, assigneeIds);
            } catch (e) {
                console.error('updateTask notification error:', e);
            }
        })();
    } else {
        // No new assignees: sync immediately (handles removals from the allowlist)
        void syncResourceTaskAccess(task.id, task.projectId, assigneeIds);
    }

    return true;
};

export const deleteTask = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteTask error:', error);
};

export const archiveTask = async (taskId: string): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .update({ archived_at: new Date().toISOString() } as any)
        .eq('id', taskId);
    if (error) console.error('archiveTask error:', error);
};

export const restoreTask = async (taskId: string): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .update({ archived_at: null } as any)
        .eq('id', taskId);
    if (error) console.error('restoreTask error:', error);
};
