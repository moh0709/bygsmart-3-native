import { supabase } from '../../../services/supabaseClient';
import { authenticatedServerFetch } from '../../../services/api/http';

const db = supabase;

export type TaskAccessRole = 'owner' | 'responsible' | 'worker' | 'viewer';

export interface TaskAccessEntry {
    userId: string | null;
    inviteEmail: string | null;
    role: TaskAccessRole;
    status: string;
    invitedBy: string;
    name: string;
    initials: string;
}

export interface FoundUser {
    id: string;
    name: string;
    initials: string;
}

/**
 * Authoritative Owner/Responsible/Worker/Viewer role for the current user
 * on a task (project or quick), mirrored client-side by
 * components/taskWorkspace/roles.ts's computeTaskRole for optimistic UI —
 * this is the source of truth backing every RLS policy that gates it.
 */
export const getEffectiveTaskRole = async (taskId: string): Promise<TaskAccessRole | null> => {
    const { data, error } = await db.rpc('get_effective_task_role', { p_task_id: taskId });
    if (error) { console.error('getEffectiveTaskRole error:', error); return null; }
    return (data as TaskAccessRole | null) ?? null;
};

/** List all access entries for a task — owner/responsible sees all; other participants see the whole list too (qta_select). */
export const listTaskAccess = async (taskId: string): Promise<TaskAccessEntry[]> => {
    const { data, error } = await db
        .from('quick_task_access')
        .select('user_id, invite_email, role, status, invited_by, profiles!quick_task_access_user_id_fkey(name, initials)')
        .eq('task_id', taskId);
    if (error) { console.error('listTaskAccess error:', error); return []; }
    return ((data ?? []) as any[]).map((r: any) => ({
        userId: r.user_id,
        inviteEmail: r.invite_email,
        role: r.role as TaskAccessRole,
        status: r.status,
        invitedBy: r.invited_by,
        name: r.profiles?.name ?? r.invite_email ?? '',
        initials: r.profiles?.initials ?? '',
    }));
};

/** Rebuild tasks.assignees from active, non-viewer access rows — a Viewer shouldn't visually appear as an assignee chip. */
const syncTaskAssignees = async (taskId: string): Promise<void> => {
    const { data: accessRows, error: accessErr } = await db
        .from('quick_task_access')
        .select('user_id, role, profiles!quick_task_access_user_id_fkey(name, initials)')
        .eq('task_id', taskId)
        .eq('status', 'active')
        .neq('role', 'viewer');
    if (accessErr) throw new Error(accessErr.message);
    const newAssignees = ((accessRows ?? []) as any[])
        .filter((r: any) => r.user_id)
        .map((r: any) => ({
            id: r.user_id,
            name: r.profiles?.name ?? '',
            initials: r.profiles?.initials ?? '',
        }));
    const { error: updateErr } = await db.from('tasks').update({ assignees: newAssignees }).eq('id', taskId);
    if (updateErr) throw new Error(updateErr.message);
};

/** Grant (or update) a role for an existing user on a task. Creates/reactivates a quick_task_access row. */
export const grantTaskAccess = async (
    taskId: string,
    userId: string,
    role: TaskAccessRole = 'worker'
): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');
    const { error } = await db
        .from('quick_task_access')
        .upsert(
            { task_id: taskId, user_id: userId, invited_by: user.id, status: 'pending', role },
            { onConflict: 'task_id,user_id' }
        );
    if (error) {
        console.error('grantTaskAccess error:', error);
        throw new Error(error.message);
    }
};

/**
 * Invite someone by email who does not have a BygSmart account yet.
 * Their access row has user_id = NULL / invite_email set; handle_new_user()
 * auto-links it to their account the moment they sign up with that email.
 */
export const inviteTaskAccessByEmailNoAccount = async (
    taskId: string,
    email: string,
    role: TaskAccessRole = 'worker'
): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');
    const { error } = await db
        .from('quick_task_access')
        .upsert(
            { task_id: taskId, invite_email: email.trim().toLowerCase(), invited_by: user.id, status: 'pending', role },
            { onConflict: 'task_id,invite_email' }
        );
    if (error) {
        console.error('inviteTaskAccessByEmailNoAccount error:', error);
        throw new Error(error.message);
    }
};

/** Exact-match lookup — used by the Team-tab "+" invite flow before falling back to an email invite. */
export const findUserByEmail = async (email: string): Promise<FoundUser | null> => {
    const { data, error } = await db.rpc('find_user_by_email', { p_email: email.trim() });
    if (error) { console.error('findUserByEmail error:', error); return null; }
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
};

/** Exact-match lookup by phone — phone is lookup-only, no SMS is sent for a non-match. */
export const findUserByPhone = async (phone: string): Promise<FoundUser | null> => {
    const { data, error } = await db.rpc('find_user_by_phone', { p_phone: phone.trim() });
    if (error) { console.error('findUserByPhone error:', error); return null; }
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
};

/** Invitee accepts their task-access invite (sets own row to 'active'). */
export const acceptTaskAccessInvite = async (taskId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');
    const { error } = await db
        .from('quick_task_access')
        .update({ status: 'active' })
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
    if (error) {
        console.error('acceptTaskAccessInvite error:', error);
        throw new Error(error.message);
    }
    await syncTaskAssignees(taskId);
};

/** Remove a user's access from a task (owner/responsible removes anyone; invitee removes themselves). */
export const revokeTaskAccess = async (taskId: string, userId: string): Promise<void> => {
    const { error } = await db
        .from('quick_task_access')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);
    if (error) {
        console.error('revokeTaskAccess error:', error);
        throw new Error(error.message);
    }
    await syncTaskAssignees(taskId);
};

/** Cancel a pending email invite for someone who hasn't signed up yet (no user_id to revoke by). */
export const revokeTaskAccessByEmail = async (taskId: string, inviteEmail: string): Promise<void> => {
    const { error } = await db
        .from('quick_task_access')
        .delete()
        .eq('task_id', taskId)
        .eq('invite_email', inviteEmail);
    if (error) {
        console.error('revokeTaskAccessByEmail error:', error);
        throw new Error(error.message);
    }
};

/** Per-task tab visibility ("Faner" settings). Owner/Responsible only — enforced server-side too. */
export const setTaskDisabledTabs = async (taskId: string, disabledTabs: string[]): Promise<void> => {
    const { error } = await db.rpc('set_task_disabled_tabs', { p_task_id: taskId, p_disabled_tabs: disabledTabs });
    if (error) {
        console.error('setTaskDisabledTabs error:', error);
        throw new Error(error.message);
    }
};

/**
 * Sends the real notification a client can't send itself: an SMTP e-mail,
 * plus — for an already-registered grantee — an in-app + web-push
 * notification. Call after grantTaskAccess/inviteTaskAccessByEmailNoAccount
 * have already written the access row; best-effort, failures are swallowed
 * so a flaky mail send never blocks the grant itself from having succeeded.
 */
export const notifyTaskInvite = async (params: { taskId: string; granteeUserId?: string; granteeEmail?: string }): Promise<void> => {
    try {
        await authenticatedServerFetch('/task/invite-notify', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    } catch (error) {
        console.error('notifyTaskInvite error:', error);
    }
};
