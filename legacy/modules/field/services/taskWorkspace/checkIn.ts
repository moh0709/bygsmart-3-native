import { TaskCheckIn } from '../../../../types';
import { supabase } from '../../../../services/supabaseClient';
import { logTimeEntry } from '../../../time';
import { mapCheckIn } from './mappers';
import { notifyUser, getProjectOwnerId, getQuickTaskOwnerId } from './notifications';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts).
const db = supabase as any;

const AUTO_CHECKOUT_HOURS = 12; // sessions older than this are auto-closed

// ---------------------------------------------------------------------------
// CHECK-IN / CHECK-OUT
// ---------------------------------------------------------------------------

/** Returns the single active (not yet checked-out) session for the user, if any. */
export const getActiveCheckIn = async (userId: string): Promise<TaskCheckIn | null> => {
    const { data, error } = await db
        .from('task_check_ins')
        .select('*')
        .eq('user_id', userId)
        .is('checked_out_at', null)
        .maybeSingle();
    if (error) { console.error('getActiveCheckIn error:', error); return null; }
    return data ? mapCheckIn(data) : null;
};

/** Returns all workers currently checked into a specific task (zero or more). */
export const getActiveCheckInForTask = async (taskId: string): Promise<TaskCheckIn[]> => {
    const { data, error } = await db
        .from('task_check_ins')
        .select('*')
        .eq('task_id', taskId)
        .is('checked_out_at', null)
        .order('checked_in_at', { ascending: true });
    if (error) { console.error('getActiveCheckInForTask error:', error); return []; }
    return (data ?? []).map(mapCheckIn);
};

export interface GeoStamp {
    lat: number;
    lng: number;
    accuracy?: number;
}

export interface CheckInUser {
    id: string;
    name: string;
}

/**
 * Check a user into a task. Fails if the user already has an active session.
 * Captures optional geolocation and notifies the Mester.
 */
export const checkInToTask = async (
    taskId: string,
    projectId: string | null,
    user: CheckInUser,
    geo?: GeoStamp
): Promise<TaskCheckIn> => {
    // Enforce single active session per user
    const existing = await getActiveCheckIn(user.id);
    if (existing) {
        throw new Error('Du er allerede checket ind på en opgave. Check ud først.');
    }

    const { data, error } = await db
        .from('task_check_ins')
        .insert({
            task_id: taskId,
            project_id: projectId,
            user_id: user.id,
            user_name: user.name,
            checked_in_at: new Date().toISOString(),
            checked_out_at: null,
            checkin_lat: geo?.lat ?? null,
            checkin_lng: geo?.lng ?? null,
            checkin_accuracy: geo?.accuracy ?? null,
            auto_closed: false,
        })
        .select('*')
        .single();

    if (error) {
        console.error('checkInToTask error:', error);
        throw new Error(error.message);
    }

    // Notify Mester (or quick-task owner)
    const ownerId = projectId
        ? await getProjectOwnerId(projectId)
        : await getQuickTaskOwnerId(taskId);
    if (ownerId && ownerId !== user.id) {
        await notifyUser(
            ownerId,
            `${user.name} er checket ind på en opgave`,
            `/task/${taskId}`,
            'task_checkin'
        );
    }

    return mapCheckIn(data);
};

export interface CheckOutParams {
    hours: number;
    description?: string;
    /**
     * When false, the session is closed without writing a time_entry. Used by
     * the calling component when the `time` module is disabled for the org —
     * check-in/out is field's own core feature and must complete regardless
     * of module entitlements; this only skips the cross-module logTimeEntry
     * side effect. Defaults to true (existing behaviour) so other callers are
     * unaffected.
     */
    logTime?: boolean;
}

/**
 * Check out of a task: close the session, write a time_entry via logTimeEntry,
 * and notify the Mester.
 */
export const checkOutOfTask = async (
    checkInId: string,
    params: CheckOutParams
): Promise<void> => {
    const { hours, description, logTime = true } = params;
    const now = new Date().toISOString();

    // Load the check-in row so we have the task/project/user context
    const { data: row, error: fetchErr } = await db
        .from('task_check_ins')
        .select('*')
        .eq('id', checkInId)
        .single();
    if (fetchErr || !row) {
        throw new Error('Check-in ikke fundet');
    }
    const checkIn = mapCheckIn(row);

    // Close the session
    const { error: closeErr } = await db
        .from('task_check_ins')
        .update({ checked_out_at: now })
        .eq('id', checkInId);
    if (closeErr) {
        console.error('checkOutOfTask close error:', closeErr);
        throw new Error(closeErr.message);
    }

    if (logTime) {
        // Write time entry — if this fails, roll back the session close so the user can retry
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await logTimeEntry({
                projectId: checkIn.projectId,
                taskId: checkIn.taskId,
                userId: user?.id ?? checkIn.userId,
                userName: checkIn.userName,
                hours,
                date: new Date().toISOString().slice(0, 10),
                description: description ?? `Check-ud: ${checkIn.taskId}`,
            });
        } catch (timeErr) {
            await db
                .from('task_check_ins')
                .update({ checked_out_at: null })
                .eq('id', checkInId);
            throw timeErr;
        }
    }

    // Notify Mester (or quick-task owner)
    const ownerId = checkIn.projectId
        ? await getProjectOwnerId(checkIn.projectId)
        : await getQuickTaskOwnerId(checkIn.taskId);
    if (ownerId && ownerId !== checkIn.userId) {
        await notifyUser(
            ownerId,
            `${checkIn.userName} er checket ud (${hours} t registreret)`,
            `/task/${checkIn.taskId}`,
            'task_checkout'
        );
    }
};

/**
 * Auto-close sessions that have been active longer than AUTO_CHECKOUT_HOURS.
 * Flags them with auto_closed=true and writes a time_entry for the elapsed time.
 * Safe to call on app start / tab focus.
 */
export const autoCloseStaleCheckIns = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const threshold = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 3600 * 1000).toISOString();

    const { data: stale, error } = await db
        .from('task_check_ins')
        .select('*')
        .eq('user_id', user.id)
        .is('checked_out_at', null)
        .lt('checked_in_at', threshold);

    if (error || !stale?.length) return;

    const now = new Date().toISOString();
    for (const row of stale) {
        const checkIn = mapCheckIn(row);
        const elapsedMs = Date.now() - new Date(checkIn.checkedInAt).getTime();
        const hours = Math.min(AUTO_CHECKOUT_HOURS, elapsedMs / 3600000);

        const { error: closeErr } = await db
            .from('task_check_ins')
            .update({ checked_out_at: now, auto_closed: true })
            .eq('id', checkIn.id);
        if (closeErr) {
            console.warn('autoCloseStaleCheckIns close error:', closeErr.message);
            continue;
        }

        try {
            await logTimeEntry({
                projectId: checkIn.projectId,
                taskId: checkIn.taskId,
                userId: checkIn.userId,
                userName: checkIn.userName,
                hours: Math.round(hours * 100) / 100,
                date: new Date().toISOString().slice(0, 10),
                description: 'Auto check-ud (session udløbet)',
            });
        } catch (e) {
            // Roll back the session close so the next auto-close attempt can retry
            await db
                .from('task_check_ins')
                .update({ checked_out_at: null, auto_closed: false })
                .eq('id', checkIn.id);
            console.warn('autoCloseStaleCheckIns logTimeEntry failed, session restored:', e);
        }
    }
};

/**
 * The current user's single open session, shaped for the home-page banner
 * (task title + project name resolved server-side). Formerly
 * services/api/taskCheckIns.ts — moved here in Phase 7 W7b because field owns
 * the check-in workflow.
 */
export const getMyActiveCheckIn = async (): Promise<{ taskId: string; taskTitle: string; projectName?: string; checkedInAt: string } | null> => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) { console.error('getMyActiveCheckIn auth error:', authError); return null; }
        if (!user) return null;
        // SECURITY DEFINER RPC — a tasks!inner(...) embed would apply tasks RLS,
        // which is narrower than task_check_ins_select and can hide a real open session.
        const { data, error } = await db.rpc('get_my_active_check_in');
        if (error) { console.error('getMyActiveCheckIn error:', error); return null; }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        return {
            taskId: row.task_id,
            taskTitle: row.task_title ?? '',
            projectName: row.project_name ?? undefined,
            checkedInAt: row.checked_in_at,
        };
    } catch (err) {
        console.error('getMyActiveCheckIn error:', err);
        return null;
    }
};
