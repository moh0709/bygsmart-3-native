import { ProjectMember, ProjectResource, ResourceKind, ResourceVisibility, ResourceStatus } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { getProjectById, getProjects } from './projects';

// --- PROJECT RESOURCES (T1 unified model) ---

const db = supabase as any;

export const getProjectResources = async (projectId: string): Promise<ProjectResource[]> => {
    const { data, error } = await db
        .from('project_resources')
        .select('id, project_id, user_id, email, name, initials, kind, visibility, status, agreed_price_ore, currency, settled_at, joined_at, invited_by, message, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('getProjectResources error:', error); return []; }
    return (data ?? []).map((r: any): ProjectResource => ({
        id: r.id,
        projectId: r.project_id,
        userId: r.user_id ?? null,
        email: r.email ?? null,
        name: r.name,
        initials: r.initials ?? '',
        kind: r.kind as ResourceKind,
        visibility: r.visibility as ResourceVisibility,
        status: r.status as ResourceStatus,
        agreedPriceOre: r.agreed_price_ore == null ? null : Number(r.agreed_price_ore),
        currency: r.currency ?? 'DKK',
        settledAt: r.settled_at ?? null,
        joinedAt: r.joined_at ?? null,
        invitedBy: r.invited_by ?? null,
        message: r.message ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
};

export const addProjectResource = async (
    projectId: string,
    resource: {
        userId?: string;
        email?: string;
        name: string;
        initials?: string;
        kind: ResourceKind;
        visibility?: ResourceVisibility;
        status?: ResourceStatus;
    }
): Promise<ProjectResource | null> => {
    const { data, error } = await db
        .from('project_resources')
        .insert({
            project_id: projectId,
            user_id: resource.userId ?? null,
            email: resource.email ?? null,
            name: resource.name,
            initials: resource.initials ?? resource.name.substring(0, 2).toUpperCase(),
            kind: resource.kind,
            visibility: resource.visibility ?? (resource.kind === 'staff' ? 'standard' : 'none'),
            status: resource.status ?? 'pending',
        })
        .select()
        .single();
    if (error) { console.error('addProjectResource error:', error); return null; }
    if (!data) return null;
    return {
        id: data.id, projectId: data.project_id, userId: data.user_id ?? null,
        email: data.email ?? null, name: data.name, initials: data.initials ?? '',
        kind: data.kind, visibility: data.visibility, status: data.status,
        agreedPriceOre: null, currency: data.currency ?? 'DKK',
        settledAt: null, joinedAt: null, invitedBy: null, message: null,
        createdAt: data.created_at, updatedAt: data.updated_at,
    };
};

export const updateProjectResource = async (
    resourceId: string,
    updates: Partial<Pick<ProjectResource, 'kind' | 'visibility' | 'status' | 'agreedPriceOre'>>
): Promise<void> => {
    const payload: any = {};
    if (updates.kind !== undefined) payload.kind = updates.kind;
    if (updates.visibility !== undefined) payload.visibility = updates.visibility;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.agreedPriceOre !== undefined) payload.agreed_price_ore = updates.agreedPriceOre;
    const { error } = await db.from('project_resources').update(payload).eq('id', resourceId);
    if (error) console.error('updateProjectResource error:', error);
};

export const removeProjectResource = async (resourceId: string): Promise<void> => {
    const { error } = await db.from('project_resources').delete().eq('id', resourceId);
    if (error) console.error('removeProjectResource error:', error);
};

export const addProjectMember = async (projectId: string, member: Partial<ProjectMember>): Promise<void> => {
    const project = await getProjectById(projectId);
    if (!project) return;

    const kind: ResourceKind = member.role === 'EXTERNAL' ? 'partner' : 'staff';
    const visibility: ResourceVisibility = (member.role === 'OWNER' || member.role === 'MANAGER') ? 'all' : 'standard';

    // Write to project_resources (canonical); trigger syncs projects.team
    await addProjectResource(projectId, {
        userId: member.id && !member.id.startsWith('temp-') ? member.id : undefined,
        email: member.email,
        name: member.name || 'Ukendt',
        initials: member.initials || 'XX',
        kind,
        visibility,
        status: member.status === 'ACTIVE' ? 'active' : 'pending',
    });

    // Also update projects.team mirror directly for immediate read consistency
    const newMember: ProjectMember = {
        id: member.id || `temp-${Date.now()}`,
        name: member.name || 'Ukendt',
        initials: member.initials || 'XX',
        role: member.role || 'EMPLOYEE',
        status: member.status || 'PENDING',
        joinedAt: new Date().toISOString(),
        email: member.email,
    };
    const updatedTeam = [...project.team, newMember];
    const { error } = await supabase.from('projects').update({ team: updatedTeam as any }).eq('id', projectId);
    if (error) { console.error('addProjectMember error:', error); return; }

    if (member.id && !member.id.startsWith('temp-')) {
        await supabase.from('notifications').insert({
            user_id: member.id,
            text: `Du er blevet inviteret til projektet "${project.name}"`,
            timestamp: new Date().toISOString(),
            is_read: false,
            link: '/projects',
            type: 'project_member_added',
            metadata: { projectId, projectName: project.name },
        } as any);
    }
};

export const acceptProjectInvitation = async (projectId: string, userId: string): Promise<void> => {
    // Update project_resources (canonical)
    await db
        .from('project_resources')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('kind', 'staff');

    // Update projects.team mirror directly for immediate consistency
    const project = await getProjectById(projectId);
    if (!project) return;
    const updatedTeam = project.team.map((m: ProjectMember) =>
        m.id === userId ? { ...m, status: 'ACTIVE' as const } : m
    );
    const { error } = await supabase.from('projects').update({ team: updatedTeam as any }).eq('id', projectId);
    if (error) console.error('acceptProjectInvitation error:', error);
};

export const getActiveWorkforce = async (userId?: string): Promise<{ userId: string; userName: string; projectName: string; projectId: string }[]> => {
    let projectIds: string[] | undefined;

    if (userId) {
        const projects = await getProjects(userId);
        if (projects.length === 0) return [];
        projectIds = projects.map(p => p.id);
    }

    let query = supabase
        .from('tasks')
        .select('assignees, project_id, projects!inner(name, id)')
        .eq('status', 'Igangværende');

    if (projectIds) {
        query = query.in('project_id', projectIds);
    }

    const { data, error } = await query;
    if (error) { console.error('getActiveWorkforce error:', error); return []; }

    const workforce: { userId: string; userName: string; projectName: string; projectId: string }[] = [];
    (data ?? []).forEach((row: any) => {
        const assignees: any[] = row.assignees ?? [];
        const projectName = row.projects?.name ?? '';
        const projectId = row.project_id;
        assignees.forEach((a: any) => {
            if (!workforce.some(w => w.userId === a.id)) {
                workforce.push({ userId: a.id, userName: a.name, projectName, projectId });
            }
        });
    });
    return workforce;
};
