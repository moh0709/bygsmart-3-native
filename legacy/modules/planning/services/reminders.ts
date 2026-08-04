import { Reminder } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { REMINDER_COLUMNS, ReminderRow } from '../../../services/api/columns';

// --- REMINDERS ---

export const mapReminder = (r: ReminderRow): Reminder => ({
    id: r.id,
    title: r.title,
    dateTime: r.date_time,
    context: r.context ?? '',
    isCompleted: r.is_completed ?? false,
});

export const createReminderForProject = async (projectId: string, data: { title: string; dateTime: string; context: string }): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
        .from('reminders')
        .insert({
            project_id: projectId,
            title: data.title,
            date_time: data.dateTime,
            context: data.context || '',
            is_completed: false,
            created_by: user.id,
        } as any);
    if (error) console.error('createReminderForProject error:', error);
};

export const getRemindersForProject = async (projectId: string): Promise<Reminder[]> => {
    const { data, error } = await supabase
        .from('reminders')
        .select(REMINDER_COLUMNS)
        .eq('project_id', projectId)
        .order('date_time', { ascending: true });
    if (error) { console.error('getRemindersForProject error:', error); return []; }
    return (data ?? []).map(mapReminder);
};

export const updateReminder = async (reminder: Reminder): Promise<void> => {
    const { error } = await supabase
        .from('reminders')
        .update({
            title: reminder.title,
            date_time: reminder.dateTime,
            context: reminder.context || '',
            is_completed: reminder.isCompleted,
        })
        .eq('id', reminder.id);
    if (error) console.error('updateReminder error:', error);
};

export const deleteReminder = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteReminder error:', error);
};
