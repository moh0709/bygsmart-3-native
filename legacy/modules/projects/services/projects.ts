import { Project, ProjectMember } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { ProjectRow } from '../../../services/api/columns';
import { createProjectBudgetBaseline } from '../../budget';

// --- PROJECTS ---

export const mapProject = (p: ProjectRow): Project => ({
    id: p.id,
    ownerId: p.owner_id,
    projectNumber: p.project_number ?? '',
    name: p.name,
    clientName: p.client_name ?? '',
    status: p.status,
    progress: p.progress ?? 0,
    startDate: p.start_date ?? '',
    endDate: p.end_date ?? '',
    address: p.address ?? '',
    description: p.description ?? '',
    regulationCount: p.regulation_count ?? 0,
    checklistCount: p.checklist_count ?? 0,
    isFavorite: p.is_favorite ?? false,
    floorPlanUrl: p.floor_plan_url ?? undefined,
    milestone: (p.milestone as unknown as Project['milestone']) ?? { title: '', dueDateRelative: '' },
    team: (p.team as unknown as ProjectMember[]) ?? [],
    budget: (p.budget as unknown as Project['budget']) ?? undefined,
});

export const getProjects = async (_userId?: string): Promise<Project[]> => {
    const { data, error } = await (supabase as any).rpc('get_projects_guarded');
    if (error) { console.error('getProjects error:', error); return []; }
    // Access filtering is handled server-side by get_projects_guarded (RLS + SECURITY DEFINER).
    // A client-side filter on owner/team[] would exclude projects accessible via quick_task_access.
    return ((data as any[]) ?? []).map(mapProject);
};

export const getProjectById = async (id: string, _userId?: string): Promise<Project | undefined> => {
    // Budget visibility is enforced server-side by get_project_guarded (nulled for non-privileged callers).
    const { data, error } = await (supabase as any).rpc('get_project_guarded', { p_project_id: id });
    if (error) { console.error('getProjectById error:', error); return undefined; }
    if (!data || data.length === 0) return undefined;
    return mapProject(data[0]);
};

export const createProjectWithPlan = async (
    name: string,
    description: string,
    tasks: any[],
    purchases: any[],
    team: any[],
    startDate?: string,
    endDate?: string,
    ownerId?: string,
    demoData?: {
        clientName?: string;
        address?: string;
        budget?: { total: number; used: number };
    },
    // Whether the caller's org is entitled to the budget module — gates the
    // budget-baseline write below (a data-integrity concern, not just UI).
    // Defaults to true so existing callers that don't pass it (demo seeding,
    // quick-create) keep their current behavior; callers with real entitlement
    // context (e.g. the create-project UI) should pass useModuleGate('budget').
    budgetModuleEnabled: boolean = true
): Promise<Project> => {
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveOwnerId = ownerId || user?.id || '';

    const projectData = {
        owner_id: effectiveOwnerId,
        project_number: `${new Date().getFullYear().toString().slice(-2)}-${Date.now().toString().slice(-5)}`,        // e.g. "26-83421"
        name,
        client_name: demoData?.clientName || 'Ny Kunde',
        status: 'I gang',
        progress: 0,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        address: demoData?.address || '',
        description,
        regulation_count: 0,
        checklist_count: tasks.reduce((acc: number, t: any) => acc + (t.checklist?.length || 0), 0),
        is_favorite: false,
        milestone: { title: 'Opstart', dueDateRelative: 'Snart' } as any,
        team: (team || []) as any,
    };

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();

    if (projectError) { console.error('createProjectWithPlan error:', projectError); throw projectError; }

    if (demoData?.budget?.total && budgetModuleEnabled) {
        try {
            await createProjectBudgetBaseline(project.id, [
                { category: 'other', amountKr: demoData.budget.total, note: 'Demoprojekt — ukendt kategorifordeling' },
            ]);
        } catch (budgetError) {
            console.warn('createProjectWithPlan budget baseline warning:', budgetError);
        }
    }

    if (tasks.length > 0) {
        const taskRows = tasks.map((t: any) => ({
            project_id: project.id,
            title: t.title,
            status: t.status || 'To Do',
            priority: t.priority || 'Mellem',
            due_date: t.dueDate || null,
            related_link: t.relatedLink || null,
            assignees: (t.assignees || []) as any,
            description: t.description || '',
            checklist: (t.checklist || []) as any,
            attachments: (t.attachments || []) as any,
            comments: (t.comments || []) as any,
            is_milestone: t.isMilestone || false,
            suggested_regulations: (t.suggestedRegulations || []) as any,
            estimated_hours: t.estimatedHours || 0,
            dependencies: [] as any,
            step: t.step || null,
        }));
        const { error: taskError } = await supabase.from('tasks').insert(taskRows);
        if (taskError) console.error('createProjectWithPlan tasks error:', taskError);
    }

    if (purchases.length > 0) {
        const purchaseRows = purchases.map((p: any) => ({
            project_id: project.id,
            name: p.name,
            details: p.details || '',
            quantity: p.quantity || 1,
            price: p.price || 0,
            status: p.status || 'Afventer',
            supplier: p.supplier || null,
            item_number: p.itemNumber || null,
            attachment: null,
            expected_delivery_date: null,
            task_id: null,
            assignee_id: null,
        }));
        const { error: purchError } = await supabase.from('purchases').insert(purchaseRows);
        if (purchError) console.error('createProjectWithPlan purchases error:', purchError);
    }

    return mapProject(project);
};
