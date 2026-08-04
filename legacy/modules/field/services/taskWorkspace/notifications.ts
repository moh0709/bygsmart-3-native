import { supabase } from '../../../../services/supabaseClient';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts).
const db = supabase as any;

/**
 * Notify a specific user (typically the project Mester / owner).
 * We use a direct insert — the notifications table INSERT policy must allow
 * this (e.g. via a trigger or relaxed insert policy). Falls back silently if
 * the insert fails so that the primary action is never blocked.
 */
export const notifyUser = async (
    userId: string,
    text: string,
    link: string,
    type = 'task_workspace'
): Promise<void> => {
    const { error } = await db.from('notifications').insert({
        user_id: userId,
        text,
        timestamp: new Date().toISOString(),
        is_read: false,
        link,
        type,
        metadata: {},
    });
    if (error) {
        console.warn('notifyUser silent failure:', error.message);
    }
};

/** Resolve the project owner_id for Mester notifications. Returns null for quick tasks (no project). */
export const getProjectOwnerId = async (projectId: string | null | undefined): Promise<string | null> => {
    if (!projectId) return null;
    const { data, error } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();
    if (error || !data) return null;
    return (data as any).owner_id ?? null;
};

/** For quick tasks (no project), resolve the task owner_id from tasks.owner_id. */
export const getQuickTaskOwnerId = async (taskId: string): Promise<string | null> => {
    const { data, error } = await db
        .from('tasks')
        .select('owner_id')
        .eq('id', taskId)
        .maybeSingle();
    if (error || !data) return null;
    return (data as any).owner_id ?? null;
};
