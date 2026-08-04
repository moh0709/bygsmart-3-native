import { Task } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { TASK_COLUMNS } from '../../../services/api/columns';
import { mapTask } from './tasks';

// --- QUICK TASKS (T5) ---

export const createQuickTask = async (task: Partial<Task>): Promise<Task> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('tasks')
        .insert({
            project_id: null,
            owner_id: user.id,
            scope: 'quick',
            title: task.title ?? 'Ny hurtigopgave',
            status: task.status || 'To Do',
            due_date: task.dueDate || null,
            assignees: (task.assignees || []) as any,
            description: task.description || '',
            checklist: [] as any,
            attachments: [] as any,
            comments: [] as any,
            is_milestone: false,
            suggested_regulations: [] as any,
            estimated_hours: task.estimatedHours ?? 0,
            dependencies: [] as any,
            step: null,
        } as any)
        .select()
        .single();
    if (error) { console.error('createQuickTask error:', error); throw error; }
    return mapTask(data);
};

export const patchTaskAttachments = async (taskId: string, attachments: Task['attachments']): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .update({ attachments: (attachments ?? []) as any })
        .eq('id', taskId);
    if (error) console.error('patchTaskAttachments error:', error);
};

export const getMyQuickTasks = async (includeArchived = false): Promise<Task[]> => {
    const db2 = supabase as any;
    let query = db2
        .from('tasks')
        .select(TASK_COLUMNS)
        .eq('scope', 'quick')
        .order('created_at', { ascending: false });
    if (!includeArchived) {
        query = query.is('archived_at', null);
    }
    const { data, error } = await query;
    if (error) { console.error('getMyQuickTasks error:', error); return []; }
    return (data ?? []).map(mapTask);
};
