import { FollowUpItem, ResourceVisibility } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { TASK_COLUMNS, PURCHASE_COLUMNS, REMINDER_COLUMNS } from '../../../services/api/columns';

// --- FOLLOW UP ---

export const getFollowUpItemsForProject = async (
    projectId: string,
    _userId?: string,
    _visibility?: ResourceVisibility
): Promise<FollowUpItem[]> => {
    // RLS on tasks, purchases, and reminders already scopes rows to what the
    // authenticated caller can see (visibility-aware policies added in T2 migration).
    // No client-side filtering needed here.
    const [tasksResult, purchasesResult, remindersResult] = await Promise.all([
        supabase.from('tasks').select(TASK_COLUMNS).eq('project_id', projectId),
        supabase.from('purchases').select(PURCHASE_COLUMNS).eq('project_id', projectId),
        supabase.from('reminders').select(REMINDER_COLUMNS).eq('project_id', projectId),
    ]);

    const items: FollowUpItem[] = [];
    const now = new Date();

    // Tasks — RLS already limits rows to what the caller may see
    (tasksResult.data ?? []).forEach((t: any) => {
        const dueDate = t.due_date ? new Date(t.due_date) : null;
        let status: any;
        if (t.status === 'Udført') status = 'Udført';
        else if (t.status === 'Igangværende') status = 'Igangværende';
        else if (dueDate && dueDate < now) status = 'Forfalden';
        else status = 'Afventer';

        items.push({
            id: `task-${t.id}`,
            title: t.title,
            category: 'Opgave',
            dueDate: t.due_date ?? null,
            status,
            isCompleted: t.status === 'Udført',
            hasReminder: Boolean(t.due_date),
            originalUrl: `/task/${t.id}`,
            originalRefId: `task-card-${t.id}`,
        });
    });

    // Purchases — RLS (purchases_select_project_member, T2 migration) hides these
    // from resources without visibility='all', so no client-side filter needed.
    (purchasesResult.data ?? []).forEach((p: any) => {
        let status: any;
        if (p.status === 'Modtaget') status = 'Udført';
        else if (p.status === 'Bestilt') status = 'Igangværende';
        else status = 'Afventer';

        items.push({
            id: `purch-${p.id}`,
            title: p.name,
            category: 'Indkøb',
            dueDate: p.expected_delivery_date ?? null,
            status,
            isCompleted: p.status === 'Modtaget',
            hasReminder: p.status !== 'Modtaget',
            originalUrl: `/project-detail/${projectId}?tab=indkob`,
            originalRefId: `purchase-item-${p.id}`,
        });
    });

    // Reminders
    (remindersResult.data ?? []).forEach((r: any) => {
        const date = new Date(r.date_time);
        let status: any;
        if (r.is_completed) status = 'Udført';
        else if (date < now) status = 'Forfalden';
        else status = 'Afventer';

        items.push({
            id: `rem-${r.id}`,
            title: r.title,
            category: 'Påmindelse',
            dueDate: r.date_time,
            status,
            isCompleted: Boolean(r.is_completed),
            hasReminder: true,
            originalUrl: `/project-detail/${projectId}?tab=pamindelser`,
            originalRefId: `reminder-${r.id}`,
        });
    });

    return items.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
};

// --- FOLLOW UP (keep existing) ---

export const updateFollowUpItemStatus = async (projectId: string, itemId: string, isCompleted: boolean): Promise<void> => {
    const dashIndex = itemId.indexOf('-');
    const type = itemId.substring(0, dashIndex);
    const id = itemId.substring(dashIndex + 1);

    if (type === 'task') {
        const { error } = await supabase
            .from('tasks')
            .update({ status: isCompleted ? 'Udført' : 'Igangværende' })
            .eq('id', id);
        if (error) console.error('updateFollowUpItemStatus task error:', error);
    } else if (type === 'purch') {
        const { error } = await supabase
            .from('purchases')
            .update({ status: isCompleted ? 'Modtaget' : 'Afventer' })
            .eq('id', id);
        if (error) console.error('updateFollowUpItemStatus purchase error:', error);
    } else if (type === 'rem') {
        const { error } = await supabase
            .from('reminders')
            .update({ is_completed: isCompleted })
            .eq('id', id);
        if (error) console.error('updateFollowUpItemStatus reminder error:', error);
    }
};
