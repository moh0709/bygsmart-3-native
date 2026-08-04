import { TimeEntry } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { TIME_ENTRY_COLUMNS, TimeEntryRow } from '../../../services/api/columns';

// --- TIME ENTRIES ---

export const mapTimeEntry = (t: TimeEntryRow): TimeEntry => ({
    id: t.id,
    projectId: t.project_id,
    taskId: t.task_id ?? undefined,
    userId: t.user_id,
    userName: t.user_name,
    hours: t.hours,
    date: t.date,
    description: t.description ?? '',
});

export const logTimeEntry = async (entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry> => {
    const { data, error } = await supabase
        .from('time_entries')
        .insert({
            project_id: entry.projectId,
            task_id: entry.taskId ?? null,
            user_id: entry.userId,
            user_name: entry.userName,
            hours: entry.hours,
            date: entry.date,
            description: entry.description || '',
        })
        .select()
        .single();
    if (error) { console.error('logTimeEntry error:', error); throw error; }
    return mapTimeEntry(data);
};

export const getTimeEntriesForProject = async (projectId: string, userId?: string): Promise<TimeEntry[]> => {
    let q = supabase
        .from('time_entries')
        .select(TIME_ENTRY_COLUMNS)
        .eq('project_id', projectId)
        .order('date', { ascending: false });
    if (userId) {
        q = q.eq('user_id', userId);
    }
    const { data, error } = await q;
    if (error) { console.error('getTimeEntriesForProject error:', error); return []; }
    return (data ?? []).map(mapTimeEntry);
};

export const getMyTimeEntriesForDay = async (date: Date = new Date()): Promise<TimeEntry[]> => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) { console.error('getMyTimeEntriesForDay auth error:', authError); return []; }
        if (!user) return [];
        // Build the local calendar day manually — toISOString() would shift across UTC.
        const dayString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const { data, error } = await supabase
            .from('time_entries')
            .select(TIME_ENTRY_COLUMNS)
            .eq('user_id', user.id)
            .eq('date', dayString)
            .order('created_at', { ascending: true });
        if (error) { console.error('getMyTimeEntriesForDay error:', error); return []; }
        return (data ?? []).map(mapTimeEntry);
    } catch (err) {
        console.error('getMyTimeEntriesForDay error:', err);
        return [];
    }
};
